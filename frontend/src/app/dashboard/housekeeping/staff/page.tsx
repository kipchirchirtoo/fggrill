'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { housekeepingAPI } from '@/lib/api';
import {
  Users, RefreshCw, Search, User, Phone, Mail, CheckCircle, Clock,
  XCircle, Bed, ClipboardList, Star, Calendar, BarChart3, Plus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  designation?: string;
  status: 'available' | 'busy' | 'off_duty' | 'on_break';
  assigned_floor?: number;
  current_task?: string;
  tasks_completed_today?: number;
  average_time_per_room?: number;
  rating?: number;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  available: { label: 'Available', color: 'text-green-700', bgColor: 'bg-green-100' },
  busy: { label: 'Busy', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  off_duty: { label: 'Off Duty', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  on_break: { label: 'On Break', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
};

export default function HousekeepingStaffPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    designation: 'Room Attendant'
  });

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { branch_id: activeBranchId || user?.branch_id };
      if (statusFilter === 'available') params.available = true;

      const response = await housekeepingAPI.getStaff(params);
      if (response.success) {
        setStaff(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, activeBranchId, user?.branch_id]);

  const handleCreateStaff = async () => {
    if (!newStaff.first_name || !newStaff.last_name) {
      toast.error('First and last name are required');
      return;
    }
    try {
      const response = await housekeepingAPI.createStaff({
        ...newStaff,
        branch_id: activeBranchId || user?.branch_id,
        status: 'available'
      });
      if (response.success) {
        toast.success('Staff member added successfully');
        setAddModalOpen(false);
        setNewStaff({ first_name: '', last_name: '', email: '', phone: '', designation: 'Room Attendant' });
        fetchStaff();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add staff member');
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: staff.length,
    available: staff.filter(s => s.status === 'available').length,
    busy: staff.filter(s => s.status === 'busy').length,
    offDuty: staff.filter(s => s.status === 'off_duty').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Housekeeping Staff</h1>
              <p className="text-gray-500">Manage housekeeping team and assignments</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchStaff} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Staff</IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-ios-lg">
                  <Users className="h-5 w-5 text-[#007AFF]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Staff</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-ios-lg">
                  <CheckCircle className="h-5 w-5 text-[#34C759]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Available</p>
                  <p className="text-xl font-bold text-[#34C759]">{stats.available}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-ios-lg">
                  <Clock className="h-5 w-5 text-[#007AFF]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Busy</p>
                  <p className="text-xl font-bold text-[#007AFF]">{stats.busy}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-ios-lg">
                  <XCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Off Duty</p>
                  <p className="text-xl font-bold text-gray-600">{stats.offDuty}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {['all', 'available', 'busy', 'off_duty'].map((status) => (
                  <IOSButton
                    key={status}
                    variant={statusFilter === status ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {/* Staff List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredStaff.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No staff found</p>
            </IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((member) => {
                const statusInfo = statusConfig[member.status] || statusConfig.available;

                return (
                  <IOSCard key={member.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                        {(member.first_name?.[0] || 'S')}{(member.last_name?.[0] || 'T')}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold">{member.first_name} {member.last_name}</p>
                          <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                            {statusInfo.label}
                          </IOSBadge>
                        </div>
                        <p className="text-sm text-gray-500">{member.designation || 'Room Attendant'}</p>

                        {member.phone && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" /> {member.phone}
                          </p>
                        )}

                        {member.assigned_floor && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Bed className="h-3 w-3" /> Floor {member.assigned_floor}
                          </p>
                        )}

                        {member.current_task && (
                          <p className="text-sm text-[#007AFF] flex items-center gap-1 mt-2">
                            <ClipboardList className="h-3 w-3" /> {member.current_task}
                          </p>
                        )}

                        {/* Stats */}
                        <div className="flex gap-4 mt-3 pt-3 border-t">
                          <div className="text-center">
                            <p className="text-lg font-bold">{member.tasks_completed_today || 0}</p>
                            <p className="text-xs text-gray-500">Today</p>
                          </div>
                          {member.average_time_per_room && (
                            <div className="text-center">
                              <p className="text-lg font-bold">{member.average_time_per_room}m</p>
                              <p className="text-xs text-gray-500">Avg Time</p>
                            </div>
                          )}
                          {member.rating && (
                            <div className="text-center">
                              <p className="text-lg font-bold flex items-center gap-1">
                                {member.rating} <Star className="h-3 w-3 text-yellow-500" />
                              </p>
                              <p className="text-xs text-gray-500">Rating</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name *</label>
                <Input value={newStaff.first_name} onChange={(e) => setNewStaff({ ...newStaff, first_name: e.target.value })} placeholder="John" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name *</label>
                <Input value={newStaff.last_name} onChange={(e) => setNewStaff({ ...newStaff, last_name: e.target.value })} placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} placeholder="john@example.com" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <Input value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} placeholder="+254..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Designation</label>
              <select
                value={newStaff.designation}
                onChange={(e) => setNewStaff({ ...newStaff, designation: e.target.value })}
                className="w-full h-11 px-3 border rounded-ios-lg bg-white"
              >
                <option value="Room Attendant">Room Attendant</option>
                <option value="Supervisor">Supervisor</option>
                <option value="Linen Attendant">Linen Attendant</option>
                <option value="Public Area Attendant">Public Area Attendant</option>
              </select>
            </div>
            <div className="flex gap-3 pt-4 border-t mt-4">
              <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
              <IOSButton onClick={handleCreateStaff} className="flex-1">Add Staff</IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}
