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
import { ClipboardList, RefreshCw, Plus, Clock, CheckCircle, Play, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface Task {
  id: string;
  room_number: string;
  task_type: string;
  priority: string;
  status: string;
  due_date: string;
  assigned_to: string;
  notes: string;
  created_at: string;
}

interface Room { id: string; room_number: string; floor: number; room_type: string; }
interface Staff { id: string; name: string; department: string; role: string; }

function HousekeepingTasksContent() {
  const { activeBranch, activeBranchId } = useBranch();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '' });
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ room_id: '', task_type: 'daily_clean', priority: 'normal', assigned_to: '', notes: '', due_date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [roomsRes, staffRes] = await Promise.all([
          facilitiesAPI.getRooms(activeBranchId),
          facilitiesAPI.getStaffList('housekeeping', activeBranchId)
        ]);
        if (roomsRes.success) setRooms(roomsRes.data || []);
        if (staffRes.success) setStaffList(staffRes.data || []);
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
      }
    };
    if (activeBranchId) fetchDropdownData();
  }, [activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.room_id) { toast.error('Please select a room'); return; }
    setIsSubmitting(true);
    try {
      const response = await facilitiesAPI.createHousekeepingTask({ 
        room_id: formData.room_id,
        task_type: formData.task_type,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        notes: formData.notes,
        due_date: formData.due_date,
        branch_id: activeBranchId 
      });
      if (response.success) {
        toast.success('Task created successfully');
        setShowModal(false);
        setFormData({ room_id: '', task_type: 'daily_clean', priority: 'normal', assigned_to: '', notes: '', due_date: new Date().toISOString().split('T')[0] });
        fetchTasks();
      } else { toast.error(response.error || 'Failed to create task'); }
    } catch (error) { toast.error('Failed to create task'); }
    finally { setIsSubmitting(false); }
  };

  useEffect(() => {
    if (activeBranchId) fetchTasks();
  }, [activeBranchId]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getHousekeepingTasks(activeBranchId);
      if (response.success) {
        setTasks(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const response = await facilitiesAPI.updateTaskStatus(taskId, status);
      if (response.success) {
        toast.success('Task status updated');
        fetchTasks();
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const getPriorityColor = (_priority?: string) => 'bg-gray-100 text-gray-700 border border-gray-200';

  const getStatusColor = (_status?: string) => 'bg-gray-100 text-gray-700 border border-gray-200';

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = !filter.status || task.status === filter.status;
    const matchesPriority = !filter.priority || task.priority === filter.priority;
    return matchesStatus && matchesPriority;
  });

  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.FACILITIES_MANAGER, UserRole.HOUSEKEEPING, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Housekeeping Tasks"
        subtitle={`Manage cleaning tasks for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchTasks} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="primary" onClick={() => setShowModal(true)} leftIcon={<Plus />}>New Task</IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{taskStats.total}</p>
              <p className="text-sm text-gray-500">Total Tasks</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{taskStats.pending}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{taskStats.inProgress}</p>
              <p className="text-sm text-gray-500">In Progress</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{taskStats.completed}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <select
                value={filter.priority}
                onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </Card>

          {/* Tasks List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map(task => (
                <Card key={task.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${getPriorityColor(task.priority)}`}>
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Room {task.room_number} - {task.task_type?.replace('_', ' ')}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Assigned to: {task.assigned_to || 'Unassigned'}
                        </p>
                        {task.notes && <p className="text-sm text-gray-400 mt-1">{task.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                        {task.status?.replace('_', ' ')}
                      </span>
                      <div className="flex gap-2">
                        {task.status === 'pending' && (
                          <IOSButton size="sm" variant="secondary" onClick={() => updateTaskStatus(task.id, 'in_progress')} leftIcon={<Play className="h-4 w-4" />}>
                            Start
                          </IOSButton>
                        )}
                        {task.status === 'in_progress' && (
                          <IOSButton size="sm" variant="primary" onClick={() => updateTaskStatus(task.id, 'completed')} leftIcon={<CheckCircle className="h-4 w-4" />}>
                            Complete
                          </IOSButton>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredTasks.length === 0 && (
            <Card className="p-12 text-center">
              <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No tasks found</h3>
              <p className="text-gray-500">Create a new task or adjust your filters</p>
            </Card>
          )}
        </div>
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create New Task</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Room *</Label>
                <select value={formData.room_id} onChange={(e) => setFormData({ ...formData, room_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">Select a room...</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>Room {room.room_number} - Floor {room.floor} ({room.room_type})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Task Type</Label>
                <select value={formData.task_type} onChange={(e) => setFormData({ ...formData, task_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="daily_clean">Daily Clean</option>
                  <option value="checkout_clean">Checkout Clean</option>
                  <option value="deep_clean">Deep Clean</option>
                  <option value="linen_change">Linen Change</option>
                  <option value="restock">Restock</option>
                  <option value="inspection">Inspection</option>
                </select>
              </div>
              <div>
                <Label>Priority</Label>
                <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <Label>Assign To</Label>
                <select value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">Unassigned</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                  ))}
                </select>
              </div>
              <div><Label>Due Date</Label><Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} /></div>
              <div><Label>Notes</Label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Additional notes..." /></div>
              <div className="flex gap-2 justify-end"><IOSButton type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</IOSButton><IOSButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Task'}</IOSButton></div>
            </form>
          </DialogContent>
        </Dialog>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function HousekeepingTasksPage() {
  return (
    <BranchPageWrapper>
      <HousekeepingTasksContent />
    </BranchPageWrapper>
  );
}
