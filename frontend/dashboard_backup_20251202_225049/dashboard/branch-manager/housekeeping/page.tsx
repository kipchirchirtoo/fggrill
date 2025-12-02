'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { housekeepingAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, Clock, CheckCircle, Play, Bed, User } from 'lucide-react';
import { toast } from 'sonner';

interface Task { id: string; room_number: string; task_type: string; priority: string; status: string; assigned_to?: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
};

export default function BranchHousekeepingPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await housekeepingAPI.getTasks();
      if (response.success) setTasks(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const filteredTasks = tasks.filter((t) => statusFilter === 'all' || t.status === statusFilter);
  const stats = { pending: tasks.filter(t => t.status === 'pending').length, inProgress: tasks.filter(t => t.status === 'in_progress').length, completed: tasks.filter(t => t.status === 'completed').length };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await housekeepingAPI.updateTaskStatus(id, status);
      toast.success('Task updated');
      fetchTasks();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Housekeeping</h1><p className="text-gray-500">Cleaning tasks</p></div>
            <IOSButton variant="secondary" onClick={fetchTasks}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><Play className="h-6 w-6 text-blue-600 mb-2" /><p className="text-sm text-gray-500">In Progress</p><p className="text-xl font-bold text-blue-600">{stats.inProgress}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-green-600 mb-2" /><p className="text-sm text-gray-500">Completed</p><p className="text-xl font-bold text-green-600">{stats.completed}</p></IOSCard>
          </div>

          <div className="flex gap-2">
            {['all', 'pending', 'in_progress', 'completed'].map((status) => (
              <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                {status === 'all' ? 'All' : statusConfig[status]?.label || status}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredTasks.length === 0 ? (
            <IOSCard className="p-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No tasks</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const status = statusConfig[task.status] || statusConfig.pending;
                return (
                  <IOSCard key={task.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Bed className="h-6 w-6 text-blue-600" /></div>
                        <div>
                          <p className="font-bold">Room {task.room_number}</p>
                          <p className="text-sm text-gray-500">{task.task_type}</p>
                          {task.assigned_to && <p className="text-xs text-gray-400 flex items-center gap-1"><User className="h-3 w-3" /> {task.assigned_to}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                        {task.status === 'pending' && <IOSButton size="sm" onClick={() => handleUpdateStatus(task.id, 'in_progress')}>Start</IOSButton>}
                        {task.status === 'in_progress' && <IOSButton size="sm" onClick={() => handleUpdateStatus(task.id, 'completed')}>Done</IOSButton>}
                      </div>
                    </div>
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
