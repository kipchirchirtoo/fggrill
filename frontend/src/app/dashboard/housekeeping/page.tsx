'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { IOSBadge } from '@/components/ui/ios-badge';
import { housekeepingAPI } from '@/lib/api';
import { 
  Sparkles, Bed, CheckCircle, Clock, AlertTriangle, Users,
  RefreshCw, ClipboardList, Eye, Play, Check,
  Building2, Layers, Timer, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Task {
  id: string;
  room_number: string;
  room_id: string;
  task_type: string;
  status: string;
  priority: string;
  assigned_to?: string;
  assigned_name?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  notes?: string;
}

interface RoomStatus {
  room_number: string;
  room_id: string;
  status: string;
  floor: number;
  room_type: string;
  priority?: string;
  last_cleaned?: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  clean: { bg: 'bg-green-100', text: 'text-green-700' },
  dirty: { bg: 'bg-red-100', text: 'text-red-700' },
  inspecting: { bg: 'bg-blue-100', text: 'text-blue-700' },
  cleaning: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  maintenance: { bg: 'bg-orange-100', text: 'text-orange-700' },
  occupied: { bg: 'bg-purple-100', text: 'text-purple-700' },
  available: { bg: 'bg-green-100', text: 'text-green-700' },
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-[#FF3B30]',
  high: 'bg-orange-500',
  normal: 'bg-[#007AFF]',
  low: 'bg-[#8E8E93]',
};

export default function HousekeepingDashboard() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rooms, setRooms] = useState<RoomStatus[]>([]);
  const [stats, setStats] = useState({
    totalRooms: 0,
    cleanRooms: 0,
    dirtyRooms: 0,
    inProgress: 0,
    pendingTasks: 0,
    completedToday: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const branchIdStr = activeBranchId ? String(activeBranchId) : undefined;
      const [tasksRes, roomsRes, statsRes] = await Promise.allSettled([
        housekeepingAPI.getTasks({ status: 'pending' }),
        housekeepingAPI.getRooms(),
        housekeepingAPI.getStats(branchIdStr),
      ]);

      if (tasksRes.status === 'fulfilled' && tasksRes.value?.success) setTasks(tasksRes.value.data || []);
      if (roomsRes.status === 'fulfilled' && roomsRes.value?.success) setRooms(roomsRes.value.data || []);
      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        setStats({
          totalRooms: statsRes.value.data?.totalRooms || 0,
          cleanRooms: statsRes.value.data?.cleanRooms || 0,
          dirtyRooms: statsRes.value.data?.dirtyRooms || 0,
          inProgress: statsRes.value.data?.inProgress || 0,
          pendingTasks: statsRes.value.data?.pendingTasks || 0,
          completedToday: statsRes.value.data?.completedToday || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartTask = async (taskId: string) => {
    try {
      await housekeepingAPI.updateTaskStatus(taskId, { status: 'in_progress' });
      toast.success('Task started');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start task');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await housekeepingAPI.updateTaskStatus(taskId, { status: 'completed' });
      toast.success('Task completed');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete task');
    }
  };

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
  const filteredRooms = selectedFloor === 'all' 
    ? rooms 
    : rooms.filter(r => r.floor === selectedFloor);

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING, UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Housekeeping Dashboard</h1>
              <p className="text-gray-500">Manage room cleaning and maintenance tasks</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="outline" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh
              </IOSButton>
              <Link href="/dashboard/housekeeping/tasks">
                <IOSButton leftIcon={<ClipboardList />}>All Tasks
                </IOSButton>
              </Link>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-ios-lg">
                  <Building2 className="h-5 w-5 text-[#007AFF]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Rooms</p>
                  <p className="text-xl font-bold">{stats.totalRooms}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-ios-lg">
                  <CheckCircle className="h-5 w-5 text-[#34C759]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Clean</p>
                  <p className="text-xl font-bold text-[#34C759]">{stats.cleanRooms}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-ios-lg">
                  <AlertTriangle className="h-5 w-5 text-[#FF3B30]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dirty</p>
                  <p className="text-xl font-bold text-[#FF3B30]">{stats.dirtyRooms}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-ios-lg">
                  <Sparkles className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">In Progress</p>
                  <p className="text-xl font-bold text-yellow-600">{stats.inProgress}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-ios-lg">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-xl font-bold text-purple-600">{stats.pendingTasks}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-ios-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Done Today</p>
                  <p className="text-xl font-bold text-emerald-600">{stats.completedToday}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Pending Tasks */}
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-sf-pro-display">Pending Tasks</h2>
                <Link href="/dashboard/housekeeping/tasks">
                  <IOSButton variant="outline" size="sm">View All</IOSButton>
                </Link>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-400" />
                  <p>All tasks completed!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {tasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="p-3 border rounded-ios-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority] || priorityColors.normal}`} />
                        <div>
                          <p className="font-medium">Room {task.room_number}</p>
                          <p className="text-sm text-gray-500 capitalize">{task.task_type?.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {task.status === 'pending' && (
                          <IOSButton size="sm" onClick={() => handleStartTask(task.id)}>
                            <Play className="h-3 w-3" />
                          </IOSButton>
                        )}
                        {task.status === 'in_progress' && (
                          <IOSButton size="sm" className="bg-[#34C759]" onClick={() => handleCompleteTask(task.id)}>
                            <Check className="h-3 w-3" />
                          </IOSButton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </IOSCard>

            {/* Room Status Grid */}
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-sf-pro-display">Room Status</h2>
                <div className="flex gap-2">
                  <select
                    value={selectedFloor}
                    onChange={(e) => setSelectedFloor(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="all">All Floors</option>
                    {floors.map(f => (
                      <option key={f} value={f}>Floor {f}</option>
                    ))}
                  </select>
                  <Link href="/dashboard/housekeeping/rooms">
                    <IOSButton variant="outline" size="sm">View All</IOSButton>
                  </Link>
                </div>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bed className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No rooms found</p>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 max-h-80 overflow-y-auto">
                  {filteredRooms.slice(0, 20).map((room) => {
                    const colors = statusColors[room.status] || statusColors.clean;
                    return (
                      <div
                        key={room.room_id || room.room_number}
                        className={`p-2 rounded-ios-lg text-center ${colors.bg} ${colors.text} cursor-pointer hover:opacity-80 transition`}
                        title={`Room ${room.room_number} - ${room.status}`}
                      >
                        <p className="font-bold text-sm">{room.room_number}</p>
                        <p className="text-xs capitalize">{room.status}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
                {Object.entries(statusColors).slice(0, 5).map(([status, colors]) => (
                  <div key={status} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded ${colors.bg}`} />
                    <span className="text-xs capitalize">{status}</span>
                  </div>
                ))}
              </div>
            </IOSCard>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/dashboard/housekeeping/tasks">
              <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-8 w-8 text-[#007AFF]" />
                  <div>
                    <p className="font-medium">Tasks</p>
                    <p className="text-sm text-gray-500">Manage all tasks</p>
                  </div>
                </div>
              </IOSCard>
            </Link>
            <Link href="/dashboard/housekeeping/rooms">
              <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <Bed className="h-8 w-8 text-[#34C759]" />
                  <div>
                    <p className="font-medium">Rooms</p>
                    <p className="text-sm text-gray-500">Room status</p>
                  </div>
                </div>
              </IOSCard>
            </Link>
            <Link href="/dashboard/housekeeping/inspections">
              <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <Eye className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="font-medium">Inspections</p>
                    <p className="text-sm text-gray-500">Quality checks</p>
                  </div>
                </div>
              </IOSCard>
            </Link>
            <Link href="/dashboard/housekeeping/staff">
              <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-orange-600" />
                  <div>
                    <p className="font-medium">Staff</p>
                    <p className="text-sm text-gray-500">Team management</p>
                  </div>
                </div>
              </IOSCard>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
