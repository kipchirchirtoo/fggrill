'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench, Calendar, Clock, CheckCircle, AlertTriangle, AlertCircle,
  Plus, Edit, Eye, Trash2, Search, Filter, RefreshCw, Loader2,
  ChevronRight, User, Building2, Repeat, Bell, X, Check, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { maintenanceAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';

interface MaintenanceTask {
  id: string;
  title: string;
  description?: string;
  type: 'corrective' | 'preventive' | 'emergency';
  category: string;
  location: string;
  room_number?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: {
    id: string;
    name: string;
  };
  scheduled_date?: string;
  due_date?: string;
  completed_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  cost?: number;
  recurring?: boolean;
  recurrence_pattern?: string;
  created_at: string;
  reported_by?: string;
  notes?: string;
}

interface MaintenanceStaff {
  id: string;
  name: string;
  role: string;
  available: boolean;
  current_tasks: number;
}

interface MaintenanceSchedulerProps {
  branchId?: number;
  compact?: boolean;
}

const TASK_CATEGORIES = [
  'HVAC', 'Plumbing', 'Electrical', 'Structural', 'Appliances',
  'Furniture', 'Flooring', 'Painting', 'Landscaping', 'General'
];

const RECURRENCE_PATTERNS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' }
];

const STATUS_CONFIG = {
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pending' },
  assigned: { color: 'bg-purple-100 text-purple-700', icon: User, label: 'Assigned' },
  in_progress: { color: 'bg-blue-100 text-blue-700', icon: Wrench, label: 'In Progress' },
  completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Completed' },
  cancelled: { color: 'bg-gray-100 text-gray-700', icon: X, label: 'Cancelled' }
};

const PRIORITY_CONFIG = {
  low: { color: 'bg-gray-100 text-gray-700', label: 'Low' },
  medium: { color: 'bg-blue-100 text-blue-700', label: 'Medium' },
  high: { color: 'bg-orange-100 text-orange-700', label: 'High' },
  critical: { color: 'bg-red-100 text-red-700', label: 'Critical' }
};

const TYPE_CONFIG = {
  corrective: { color: 'bg-orange-100 text-orange-700', label: 'Corrective' },
  preventive: { color: 'bg-blue-100 text-blue-700', label: 'Preventive' },
  emergency: { color: 'bg-red-100 text-red-700', label: 'Emergency' }
};

export function MaintenanceScheduler({ branchId, compact = false }: MaintenanceSchedulerProps) {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [staff, setStaff] = useState<MaintenanceStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'corrective' as 'corrective' | 'preventive' | 'emergency',
    category: '',
    location: '',
    room_number: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    assigned_to: '',
    scheduled_date: '',
    due_date: '',
    estimated_hours: 0,
    recurring: false,
    recurrence_pattern: ''
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    overdue: 0,
    preventive: 0,
    completedThisMonth: 0
  });

  useEffect(() => {
    fetchTasks();
    fetchStaff();
  }, [branchId]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await maintenanceAPI.getRequests(branchId);
      const tasksData = response.data || response.requests || response || [];

      const processed: MaintenanceTask[] = tasksData.map((t: any) => ({
        id: t.id,
        title: t.title || t.issue_type || 'Maintenance Task',
        description: t.description,
        type: t.type || t.request_type || 'corrective',
        category: t.category || 'General',
        location: t.location || '',
        room_number: t.room_number,
        priority: t.priority || 'medium',
        status: t.status || 'pending',
        assigned_to: t.assigned_to ? {
          id: t.assigned_to.id || t.assigned_to,
          name: t.assigned_to.name || t.assigned_to
        } : undefined,
        scheduled_date: t.scheduled_date,
        due_date: t.due_date,
        completed_date: t.completed_date || t.completed_at,
        estimated_hours: t.estimated_hours,
        actual_hours: t.actual_hours,
        cost: t.cost,
        recurring: t.recurring || false,
        recurrence_pattern: t.recurrence_pattern,
        created_at: t.created_at,
        reported_by: t.reported_by,
        notes: t.notes
      }));

      setTasks(processed);

      // Calculate stats
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      setStats({
        total: processed.length,
        pending: processed.filter(t => t.status === 'pending').length,
        inProgress: processed.filter(t => t.status === 'in_progress' || t.status === 'assigned').length,
        overdue: processed.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'completed').length,
        preventive: processed.filter(t => t.type === 'preventive').length,
        completedThisMonth: processed.filter(t =>
          t.status === 'completed' &&
          t.completed_date &&
          new Date(t.completed_date) >= monthStart
        ).length
      });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load maintenance tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      // In production, this would fetch maintenance staff
      setStaff([
        { id: '1', name: 'John Technician', role: 'Senior Technician', available: true, current_tasks: 2 },
        { id: '2', name: 'Mary Engineer', role: 'HVAC Specialist', available: true, current_tasks: 1 },
        { id: '3', name: 'Peter Electrician', role: 'Electrician', available: false, current_tasks: 3 }
      ]);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(term) ||
        t.location.toLowerCase().includes(term) ||
        t.room_number?.includes(term) ||
        t.category.toLowerCase().includes(term)
      );
    }

    if (statusFilter) {
      result = result.filter(t => t.status === statusFilter);
    }

    if (typeFilter) {
      result = result.filter(t => t.type === typeFilter);
    }

    if (priorityFilter) {
      result = result.filter(t => t.priority === priorityFilter);
    }

    return result.sort((a, b) => {
      // Sort by priority first, then by date
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tasks, searchTerm, statusFilter, typeFilter, priorityFilter]);

  const handleNewTask = () => {
    setSelectedTask(null);
    setFormData({
      title: '',
      description: '',
      type: 'corrective',
      category: '',
      location: '',
      room_number: '',
      priority: 'medium',
      assigned_to: '',
      scheduled_date: '',
      due_date: '',
      estimated_hours: 0,
      recurring: false,
      recurrence_pattern: ''
    });
    setIsNewModalOpen(true);
  };

  const handleEditTask = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      type: task.type,
      category: task.category,
      location: task.location,
      room_number: task.room_number || '',
      priority: task.priority,
      assigned_to: task.assigned_to?.id || '',
      scheduled_date: task.scheduled_date?.split('T')[0] || '',
      due_date: task.due_date?.split('T')[0] || '',
      estimated_hours: task.estimated_hours || 0,
      recurring: task.recurring || false,
      recurrence_pattern: task.recurrence_pattern || ''
    });
    setIsNewModalOpen(true);
  };

  const handleSubmitTask = async () => {
    if (!formData.title || !formData.category || !formData.location) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const taskData = {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        category: formData.category,
        location: formData.location,
        room_number: formData.room_number || '',
        priority: formData.priority,
        issue_type: formData.type,
        reported_by: user?.name || 'Staff',
        branch_id: branchId
      };

      if (selectedTask) {
        await maintenanceAPI.updateRequest(selectedTask.id, taskData);
        toast.success('Task updated successfully');
      } else {
        await maintenanceAPI.createRequest(taskData);
        toast.success('Task created successfully');
      }

      setIsNewModalOpen(false);
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      await maintenanceAPI.updateRequest(taskId, { status: newStatus });
      toast.success('Status updated');
      fetchTasks();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await maintenanceAPI.deleteRequest(taskId);
      toast.success('Task deleted');
      fetchTasks();
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="h-6 w-6" />
            Maintenance Scheduler
          </h2>
          <p className="text-sm text-gray-500">{stats.total} tasks • {stats.overdue} overdue</p>
        </div>
        <div className="flex items-center gap-3">
          <IOSButton variant="outline" onClick={fetchTasks}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </IOSButton>
          <IOSButton onClick={handleNewTask} className="bg-[#3C3C43] hover:bg-[#000000] text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </IOSButton>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <IOSCard className="p-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-[#3C3C43]" />
            <div>
              <p className="text-xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-yellow-50">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-xl font-bold text-yellow-700">{stats.pending}</p>
              <p className="text-xs text-yellow-600">Pending</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-blue-50">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xl font-bold text-blue-700">{stats.inProgress}</p>
              <p className="text-xs text-blue-600">In Progress</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-xl font-bold text-red-700">{stats.overdue}</p>
              <p className="text-xs text-red-600">Overdue</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-purple-50">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-xl font-bold text-purple-700">{stats.preventive}</p>
              <p className="text-xs text-purple-600">Preventive</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-green-50">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xl font-bold text-green-700">{stats.completedThisMonth}</p>
              <p className="text-xs text-green-600">This Month</p>
            </div>
          </div>
        </IOSCard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-ios-lg text-sm"
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border rounded-ios-lg text-sm"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 border rounded-ios-lg text-sm"
        >
          <option value="">All Priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* Tasks List */}
      <IOSCard className="divide-y">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No maintenance tasks found</p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
            const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
            const typeConfig = TYPE_CONFIG[task.type] || TYPE_CONFIG.corrective;
            const StatusIcon = statusConfig.icon;
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`p-4 hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${typeConfig.color}`}>
                      <Wrench className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold font-sf-pro-display">{task.title}</h3>
                        {task.recurring && (
                          <Repeat className="h-4 w-4 text-purple-500" />
                        )}
                        {isOverdue && (
                          <IOSBadge className="bg-red-100 text-red-700">Overdue</IOSBadge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {task.location}
                        {task.room_number && ` • Room ${task.room_number}`}
                        {task.assigned_to && ` • ${task.assigned_to.name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      {task.due_date && (
                        <p className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          Due: {formatDate(task.due_date)}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">{task.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <IOSBadge className={priorityConfig.color}>{priorityConfig.label}</IOSBadge>
                      <IOSBadge className={statusConfig.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </IOSBadge>
                    </div>
                    <div className="flex items-center gap-1">
                      {task.status === 'pending' && (
                        <IOSButton
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                          title="Start"
                        >
                          <Wrench className="h-4 w-4 text-blue-600" />
                        </IOSButton>
                      )}
                      {task.status === 'in_progress' && (
                        <IOSButton
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(task.id, 'completed')}
                          title="Complete"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </IOSButton>
                      )}
                      <IOSButton
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditTask(task)}
                      >
                        <Edit className="h-4 w-4" />
                      </IOSButton>
                      <IOSButton
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </IOSButton>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </IOSCard>

      {/* New/Edit Task Modal */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTask ? 'Edit Maintenance Task' : 'New Maintenance Task'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., AC Unit Repair"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-ios-lg"
                >
                  {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-ios-lg"
                >
                  <option value="">Select category...</option>
                  {TASK_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Location *</label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., 2nd Floor, Room 201"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Room Number</label>
                <Input
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  placeholder="e.g., 201"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-ios-lg"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Assign To</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 border rounded-ios-lg"
                >
                  <option value="">Unassigned</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id} disabled={!s.available}>
                      {s.name} ({s.role}) {!s.available && '- Busy'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Scheduled Date</label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Due Date</label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Estimated Hours</label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.estimated_hours || ''}
                  onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Recurring */}
            {formData.type === 'preventive' && (
              <div className="p-4 bg-purple-50 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={formData.recurring}
                    onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <Repeat className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">Make this a recurring task</span>
                </label>
                {formData.recurring && (
                  <select
                    value={formData.recurrence_pattern}
                    onChange={(e) => setFormData({ ...formData, recurrence_pattern: e.target.value })}
                    className="w-full px-3 py-2 border rounded-ios-lg bg-white"
                  >
                    <option value="">Select frequency...</option>
                    {RECURRENCE_PATTERNS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the task..."
                className="w-full px-3 py-2 border rounded-ios-lg resize-none"
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <IOSButton variant="outline" className="flex-1" onClick={() => setIsNewModalOpen(false)}>
                Cancel
              </IOSButton>
              <IOSButton
                className="flex-1 bg-[#3C3C43] hover:bg-[#000000]"
                onClick={handleSubmitTask}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {selectedTask ? 'Update Task' : 'Create Task'}
              </IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
