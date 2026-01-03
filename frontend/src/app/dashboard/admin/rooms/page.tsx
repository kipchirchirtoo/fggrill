'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { roomsAPI } from '@/lib/api';
import { Bed, RefreshCw, Plus, Search, CheckCircle, XCircle, Clock, Wrench, Edit2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

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
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ room_number: '', room_type: 'standard', floor: 1, price: 0 });

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await roomsAPI.getRooms();
      if (response.success) setRooms(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const resetForm = () => setFormData({ room_number: '', room_type: 'standard', floor: 1, price: 0 });

  const handleAddRoom = async () => {
    if (!formData.room_number) { toast.error('Room number is required'); return; }
    setIsSubmitting(true);
    try {
      await roomsAPI.createRoom(formData);
      toast.success('Room added');
      setAddModalOpen(false);
      resetForm();
      fetchRooms();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const openEditModal = (room: Room) => {
    setSelectedRoom(room);
    setFormData({ room_number: room.room_number, room_type: room.room_type, floor: room.floor, price: room.price || 0 });
    setEditModalOpen(true);
  };

  const handleUpdateRoom = async () => {
    if (!selectedRoom || !formData.room_number) { toast.error('Room number is required'); return; }
    setIsSubmitting(true);
    try {
      await roomsAPI.updateRoom(selectedRoom.id, formData);
      toast.success('Room updated');
      setEditModalOpen(false);
      setSelectedRoom(null);
      resetForm();
      fetchRooms();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;
    setIsSubmitting(true);
    try {
      await roomsAPI.deleteRoom(selectedRoom.id);
      toast.success('Room deleted');
      setDeleteConfirmOpen(false);
      setSelectedRoom(null);
      fetchRooms();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

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
              <IOSButton variant="secondary" onClick={fetchRooms} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Room</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Bed className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500"><CheckCircle className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Available</p><p className="text-xl font-bold text-[#34C759]">{stats.available}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-[#007AFF]"><Bed className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Occupied</p><p className="text-xl font-bold text-[#007AFF]">{stats.occupied}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input placeholder="Search rooms..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
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
                    <div className="flex gap-1 mt-2">
                      <IOSButton size="sm" variant="outline" onClick={() => openEditModal(room)}><Edit2 className="h-3 w-3" /></IOSButton>
                      <IOSButton size="sm" variant="destructive" onClick={() => { setSelectedRoom(room); setDeleteConfirmOpen(true); }}><Trash2 className="h-3 w-3" /></IOSButton>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Room Modal */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Room</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Room Number *</label><Input value={formData.room_number} onChange={(e) => setFormData({ ...formData, room_number: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Room Type</label>
                <select value={formData.room_type} onChange={(e) => setFormData({ ...formData, room_type: e.target.value })} className="w-full p-2 border rounded-lg">
                  <option value="standard">Standard</option>
                  <option value="deluxe">Deluxe</option>
                  <option value="suite">Suite</option>
                  <option value="executive">Executive</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Floor</label><Input type="number" value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 1 })} /></div>
              <div><label className="text-sm font-medium">Price (KES)</label><Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddRoom} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Adding...' : 'Add'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Room Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setSelectedRoom(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Room</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Room Number *</label><Input value={formData.room_number} onChange={(e) => setFormData({ ...formData, room_number: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Room Type</label>
                <select value={formData.room_type} onChange={(e) => setFormData({ ...formData, room_type: e.target.value })} className="w-full p-2 border rounded-lg">
                  <option value="standard">Standard</option>
                  <option value="deluxe">Deluxe</option>
                  <option value="suite">Suite</option>
                  <option value="executive">Executive</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Floor</label><Input type="number" value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 1 })} /></div>
              <div><label className="text-sm font-medium">Price (KES)</label><Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleUpdateRoom} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Updating...' : 'Update'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-red-600">Delete Room</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-stone-600">Are you sure you want to delete this room?</p>
              {selectedRoom && <div className="p-3 bg-stone-50 rounded-lg"><p className="font-medium">Room {selectedRoom.room_number}</p><p className="text-sm text-stone-500">{selectedRoom.room_type}</p></div>}
              <div className="flex gap-2">
                <IOSButton variant="secondary" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>Cancel</IOSButton>
                <IOSButton variant="destructive" className="flex-1" onClick={handleDeleteRoom} disabled={isSubmitting}>{isSubmitting ? 'Deleting...' : 'Delete'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
