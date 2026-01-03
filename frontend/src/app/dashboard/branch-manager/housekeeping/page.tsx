'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { housekeepingAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, Clock, CheckCircle, Play, Bed, User, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Task { id: string; room_number: string; task_type: string; priority: string; status: string; assigned_to?: string; branch_id?: number; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
};

export default function BranchHousekeepingPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  // Use active branch from context, fallback to user's branch
  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchTasks = useCallback(async () => {
    if (!currentBranchId) {
      setTasks([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await housekeepingAPI.getTasks({ branch_id: currentBranchId });
      if (response.success) setTasks(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [currentBranchId]);

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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Housekeeping</h1>
              <p className="text-gray-500 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch?.name || 'Select a branch'}
              </p>
            </div>
            <IOSButton variant="secondary" onClick={fetchTasks} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><Play className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">In Progress</p><p className="text-xl font-bold text-[#007AFF]">{stats.inProgress}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Completed</p><p className="text-xl font-bold text-[#34C759]">{stats.completed}</p></IOSCard>
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
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Bed className="h-6 w-6 text-[#007AFF]" /></div>
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
