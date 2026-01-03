'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { housekeepingAPI } from '@/lib/api';
import { 
  Sparkles, Bed, CheckCircle, Clock, AlertTriangle, Users,
  RefreshCw, ClipboardList, Eye, Play, Check, Plus, Search,
  Building2, Layers, Timer, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { NewTaskModal, TaskFormData } from '@/components/modals/HousekeepingTaskModal';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

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
  clean: { bg: 'bg-stone-100', text: 'text-stone-700' },
  dirty: { bg: 'bg-stone-200', text: 'text-stone-800' },
  inspecting: { bg: 'bg-stone-100', text: 'text-stone-600' },
  cleaning: { bg: 'bg-stone-150', text: 'text-stone-700' },
  maintenance: { bg: 'bg-stone-200', text: 'text-stone-700' },
  occupied: { bg: 'bg-stone-300', text: 'text-stone-800' },
  available: { bg: 'bg-stone-50', text: 'text-stone-600' },
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-stone-700',
  high: 'bg-stone-600',
  normal: 'bg-stone-500',
  low: 'bg-stone-400',
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
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const currentBranchId = activeBranchId || user?.branch_id;
    if (!currentBranchId) return;
    
    try {
      const [tasksRes, roomsRes, statsRes] = await Promise.allSettled([
        housekeepingAPI.getTasks({ status: 'pending', branch_id: currentBranchId }),
        housekeepingAPI.getRooms(),
        housekeepingAPI.getStats(String(currentBranchId)),
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

  const handleCreateTask = async (data: TaskFormData) => {
    try {
      await housekeepingAPI.createTask({
        ...data,
        status: 'pending',
      });
      fetchData();
    } catch (error: any) {
      throw error;
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = searchQuery === '' || 
      task.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.task_type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = taskFilter === 'all' || task.status === taskFilter;
    return matchesSearch && matchesFilter;
  });

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
  const filteredRooms = selectedFloor === 'all' 
    ? rooms 
    : rooms.filter(r => r.floor === selectedFloor);

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING, UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Housekeeping</h1>
              <p className="text-stone-500 mt-0.5">Manage room cleaning and maintenance tasks</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchData} disabled={isLoading} className="btn-secondary">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button onClick={() => setShowNewTaskModal(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                <span>New Task</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Rooms', value: stats.totalRooms, icon: Building2 },
              { label: 'Clean', value: stats.cleanRooms, icon: CheckCircle },
              { label: 'Dirty', value: stats.dirtyRooms, icon: AlertTriangle },
              { label: 'In Progress', value: stats.inProgress, icon: Sparkles },
              { label: 'Pending', value: stats.pendingTasks, icon: Clock },
              { label: 'Done Today', value: stats.completedToday, icon: TrendingUp },
            ].map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon">
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="stat-value text-[20px]">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Pending Tasks */}
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-stone-900">Tasks</h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-[12px] w-28 bg-stone-50 border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-300"
                    />
                  </div>
                  <select
                    value={taskFilter}
                    onChange={(e) => setTaskFilter(e.target.value)}
                    className="px-2 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded-lg"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                  </select>
                </div>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-stone-400" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon bg-emerald-100">
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="empty-state-title">All tasks completed!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
                  {filteredTasks.slice(0, 8).map((task) => (
                    <div key={task.id} className="p-3 bg-stone-50 rounded-lg flex items-center justify-between hover:bg-stone-100 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority] || priorityColors.normal}`} />
                        <div>
                          <p className="text-[13px] font-medium text-stone-800">Room {task.room_number}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] text-stone-500 capitalize">{task.task_type?.replace('_', ' ')}</p>
                            {task.assigned_name && (
                              <span className="text-[10px] text-stone-400">• {task.assigned_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.status === 'in_progress' && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">In Progress</span>
                        )}
                        {task.status === 'pending' && (
                          <button 
                            onClick={() => handleStartTask(task.id)} 
                            className="p-1.5 rounded-md bg-stone-200 hover:bg-stone-300 transition-colors flex items-center gap-1"
                            title="Start Task"
                          >
                            <Play className="h-3 w-3 text-stone-700" />
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button 
                            onClick={() => handleCompleteTask(task.id)} 
                            className="p-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 transition-colors"
                            title="Mark Complete"
                          >
                            <Check className="h-3 w-3 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredTasks.length === 0 && !isLoading && (
                    <div className="text-center py-6 text-stone-500 text-sm">
                      {searchQuery || taskFilter !== 'all' ? 'No matching tasks' : 'No pending tasks'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Room Status Grid */}
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-stone-900">Room Status</h2>
                <div className="flex gap-2">
                  <select
                    value={selectedFloor}
                    onChange={(e) => setSelectedFloor(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    className="px-2 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded-lg"
                  >
                    <option value="all">All Floors</option>
                    {floors.map(f => (
                      <option key={f} value={f}>Floor {f}</option>
                    ))}
                  </select>
                  <Link href="/dashboard/housekeeping/rooms">
                    <button className="text-[13px] font-medium text-stone-600 hover:text-stone-900">View All</button>
                  </Link>
                </div>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-stone-400" />
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Bed className="h-6 w-6 text-stone-400" />
                  </div>
                  <p className="empty-state-title">No rooms found</p>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 max-h-80 overflow-y-auto scrollbar-thin">
                  {filteredRooms.slice(0, 20).map((room) => {
                    const colors = statusColors[room.status] || statusColors.clean;
                    return (
                      <div
                        key={room.room_id || room.room_number}
                        className={`p-2 rounded-lg text-center ${colors.bg} ${colors.text} cursor-pointer hover:opacity-80 transition`}
                        title={`Room ${room.room_number} - ${room.status}`}
                      >
                        <p className="font-semibold text-[12px]">{room.room_number}</p>
                        <p className="text-[10px] capitalize">{room.status}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-stone-100">
                {Object.entries(statusColors).slice(0, 5).map(([status, colors]) => (
                  <div key={status} className="flex items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded ${colors.bg}`} />
                    <span className="text-[11px] text-stone-500 capitalize">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: '/dashboard/housekeeping/tasks', icon: ClipboardList, label: 'Tasks', desc: 'Manage all tasks' },
              { href: '/dashboard/housekeeping/rooms', icon: Bed, label: 'Rooms', desc: 'Room status' },
              { href: '/dashboard/housekeeping/inspections', icon: Eye, label: 'Inspections', desc: 'Quality checks' },
              { href: '/dashboard/housekeeping/staff', icon: Users, label: 'Staff', desc: 'Team management' },
            ].map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="card-elevated-hover p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-stone-50 text-stone-500">
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-stone-800">{link.label}</p>
                    <p className="text-[11px] text-stone-500">{link.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </DashboardLayout>

        {/* New Task Modal */}
        <NewTaskModal
          isOpen={showNewTaskModal}
          onClose={() => setShowNewTaskModal(false)}
          onSubmit={handleCreateTask}
          rooms={rooms.map(r => ({ room_number: r.room_number, room_id: r.room_id }))}
        />
    </ProtectedRoute>
  );
}
