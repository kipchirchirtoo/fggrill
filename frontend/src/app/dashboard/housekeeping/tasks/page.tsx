'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { housekeepingAPI } from '@/lib/api';
import { 
  ClipboardList, Plus, Search, RefreshCw, Filter, Play, Pause, Check,
  Clock, AlertTriangle, User, Bed, Calendar, MoreVertical, X, Edit2, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
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
  estimated_duration?: number;
  notes?: string;
  checklist?: { item: string; completed: boolean }[];
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  completed: { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'bg-[#FF3B30] text-white' },
  high: { label: 'High', color: 'bg-orange-500 text-white' },
  normal: { label: 'Normal', color: 'bg-[#007AFF] text-white' },
  low: { label: 'Low', color: 'bg-[#8E8E93] text-white' },
};

const taskTypes = [
  { value: 'checkout_clean', label: 'Checkout Clean' },
  { value: 'stayover_clean', label: 'Stayover Clean' },
  { value: 'deep_clean', label: 'Deep Clean' },
  { value: 'turndown', label: 'Turndown Service' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'maintenance', label: 'Maintenance' },
];

export default function HousekeepingTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // New task form
  const [newTask, setNewTask] = useState({
    room_number: '',
    task_type: 'checkout_clean',
    priority: 'normal',
    assigned_to: '',
    notes: '',
  });

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (typeFilter !== 'all') params.taskType = typeFilter;

      const response = await housekeepingAPI.getTasks(params);
      if (response.success) {
        setTasks(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter, typeFilter]);

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
    fetchTasks();
    fetchStaff();
  }, [fetchTasks]);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = 
      task.room_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assigned_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleCreateTask = async () => {
    if (!newTask.room_number) {
      toast.error('Please enter room number');
      return;
    }
    try {
      await housekeepingAPI.createTask(newTask);
      toast.success('Task created successfully');
      setCreateModalOpen(false);
      setNewTask({ room_number: '', task_type: 'checkout_clean', priority: 'normal', assigned_to: '', notes: '' });
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create task');
    }
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    try {
      await housekeepingAPI.updateTaskStatus(taskId, { status });
      toast.success(`Task ${status === 'completed' ? 'completed' : 'updated'}`);
      fetchTasks();
      setDetailsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update task');
    }
  };

  const handleAssignTask = async (taskId: string, assignedTo: string) => {
    try {
      await housekeepingAPI.assignTask(taskId, { assignedTo });
      toast.success('Task assigned');
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign task');
    }
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setNewTask({
      room_number: task.room_number,
      task_type: task.task_type,
      priority: task.priority,
      assigned_to: task.assigned_to || '',
      notes: task.notes || '',
    });
    setEditModalOpen(true);
  };

  const handleEditTask = async () => {
    if (!selectedTask || !newTask.room_number) {
      toast.error('Please enter room number');
      return;
    }
    try {
      await housekeepingAPI.updateTask(selectedTask.id, newTask);
      toast.success('Task updated successfully');
      setEditModalOpen(false);
      setSelectedTask(null);
      setNewTask({ room_number: '', task_type: 'checkout_clean', priority: 'normal', assigned_to: '', notes: '' });
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    setIsDeleting(true);
    try {
      await housekeepingAPI.deleteTask(selectedTask.id);
      toast.success('Task deleted successfully');
      setDeleteConfirmOpen(false);
      setSelectedTask(null);
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteTask = (task: Task) => {
    setSelectedTask(task);
    setDeleteConfirmOpen(true);
  };

  // Stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING, UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Housekeeping Tasks</h1>
              <p className="text-gray-500">Manage cleaning and maintenance tasks</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="outline" onClick={fetchTasks} leftIcon={<RefreshCw />}>Refresh
              </IOSButton>
              <IOSButton onClick={() => setCreateModalOpen(true)} leftIcon={<Plus />}>
                New Task
              </IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Total Tasks</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-2xl font-bold text-[#007AFF]">{stats.inProgress}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-[#34C759]">{stats.completed}</p>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <Input
                    placeholder="Search by room or staff..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
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
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-2 border rounded-ios-lg text-sm"
                >
                  <option value="all">All Priority</option>
                  {Object.entries(priorityConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 border rounded-ios-lg text-sm"
                >
                  <option value="all">All Types</option>
                  {taskTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </IOSCard>

          {/* Tasks List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No tasks found</p>
            </IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const statusInfo = statusConfig[task.status] || statusConfig.pending;
                const priorityInfo = priorityConfig[task.priority] || priorityConfig.normal;

                return (
                  <IOSCard key={task.id} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center">
                          <Bed className="h-6 w-6 text-[#007AFF]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold">Room {task.room_number}</p>
                            <span className={`px-2 py-0.5 rounded text-xs ${priorityInfo.color}`}>
                              {priorityInfo.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 capitalize">
                            {task.task_type?.replace('_', ' ')}
                          </p>
                          {task.assigned_name && (
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                              <User className="h-3 w-3" /> {task.assigned_name}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </IOSBadge>

                        <div className="flex gap-2">
                          {task.status === 'pending' && (
                            <IOSButton size="sm" onClick={() => handleUpdateStatus(task.id, 'in_progress')} leftIcon={<Play />}>
                              Start
                            </IOSButton>
                          )}
                          {task.status === 'in_progress' && (
                            <IOSButton size="sm" className="bg-[#34C759]" onClick={() => handleUpdateStatus(task.id, 'completed')} leftIcon={<Check />}>
                              Complete
                            </IOSButton>
                          )}
                          <IOSButton 
                            size="sm" 
                            variant="outline"
                            onClick={() => openEditModal(task)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </IOSButton>
                          <IOSButton 
                            size="sm" 
                            variant="destructive"
                            onClick={() => confirmDeleteTask(task)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IOSButton>
                          <IOSButton 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedTask(task);
                              setDetailsModalOpen(true);
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </IOSButton>
                        </div>
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Task Modal */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Room Number *</label>
                <Input
                  value={newTask.room_number}
                  onChange={(e) => setNewTask({ ...newTask, room_number: e.target.value })}
                  placeholder="e.g., 101"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Task Type</label>
                <select
                  value={newTask.task_type}
                  onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg mt-1"
                >
                  {taskTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg mt-1"
                >
                  {Object.entries(priorityConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Assign To</label>
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg mt-1"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name || `${s.first_name} ${s.last_name}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={newTask.notes}
                  onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg mt-1"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <IOSButton variant="outline" onClick={() => setCreateModalOpen(false)} className="flex-1">
                  Cancel
                </IOSButton>
                <IOSButton onClick={handleCreateTask} className="flex-1">
                  Create Task
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Task Details Modal */}
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Task Details</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-gray-50 rounded-ios-lg">
                  <p className="font-bold text-lg">Room {selectedTask.room_number}</p>
                  <p className="text-gray-500 capitalize">{selectedTask.task_type?.replace('_', ' ')}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-medium capitalize">{selectedTask.status?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Priority</p>
                    <p className="font-medium capitalize">{selectedTask.priority}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Assigned To</p>
                    <p className="font-medium">{selectedTask.assigned_name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="font-medium">{new Date(selectedTask.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {selectedTask.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="text-sm">{selectedTask.notes}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  {selectedTask.status === 'pending' && (
                    <IOSButton className="flex-1" onClick={() => handleUpdateStatus(selectedTask.id, 'in_progress')} leftIcon={<Play />}>
                      Start Task
                    </IOSButton>
                  )}
                  {selectedTask.status === 'in_progress' && (
                    <IOSButton className="flex-1 bg-[#34C759]" onClick={() => handleUpdateStatus(selectedTask.id, 'completed')} leftIcon={<Check />}>
                      Complete
                    </IOSButton>
                  )}
                  <IOSButton variant="outline" className="flex-1 text-[#FF3B30]" onClick={() => handleUpdateStatus(selectedTask.id, 'cancelled')} leftIcon={<X />}>
                    Cancel
                  </IOSButton>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Task Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setSelectedTask(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="h-5 w-5" />
                Edit Task
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Room Number *</label>
                <Input
                  value={newTask.room_number}
                  onChange={(e) => setNewTask({ ...newTask, room_number: e.target.value })}
                  placeholder="e.g., 101"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Task Type</label>
                <select
                  value={newTask.task_type}
                  onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg mt-1"
                >
                  {taskTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg mt-1"
                >
                  {Object.entries(priorityConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Assign To</label>
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg mt-1"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name || `${s.first_name} ${s.last_name}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={newTask.notes}
                  onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg mt-1"
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <IOSButton variant="outline" onClick={() => setEditModalOpen(false)} className="flex-1">
                  Cancel
                </IOSButton>
                <IOSButton onClick={handleEditTask} className="flex-1">
                  Update Task
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Delete Task
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-stone-600">
                Are you sure you want to delete this task?
              </p>
              {selectedTask && (
                <div className="p-3 bg-stone-50 rounded-lg">
                  <p className="font-medium">Room {selectedTask.room_number}</p>
                  <p className="text-sm text-stone-500 capitalize">
                    {selectedTask.task_type?.replace('_', ' ')} • {selectedTask.priority}
                  </p>
                </div>
              )}
              <p className="text-sm text-stone-500">
                This action cannot be undone.
              </p>
              <div className="flex gap-2 pt-2">
                <IOSButton 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => { setDeleteConfirmOpen(false); setSelectedTask(null); }}
                >
                  Cancel
                </IOSButton>
                <IOSButton 
                  className="flex-1"
                  onClick={handleDeleteTask}
                  disabled={isDeleting}
                  variant="destructive"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
