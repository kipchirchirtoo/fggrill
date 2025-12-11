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
import { Wrench, RefreshCw, Plus, Clock, CheckCircle, Play, AlertTriangle, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  location: string;
  priority: string;
  status: string;
  category: string;
  assigned_to: string;
  created_at: string;
  started_at: string;
  completed_at: string;
}

interface Room { id: string; room_number: string; floor: number; }
interface Staff { id: string; name: string; department: string; role: string; }

function WorkOrdersContent() {
  const { activeBranch, activeBranchId } = useBranch();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '' });
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', location: '', category: 'electrical', priority: 'normal', assigned_to: '' });

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [roomsRes, staffRes] = await Promise.all([
          facilitiesAPI.getRooms(activeBranchId),
          facilitiesAPI.getStaffList('maintenance', activeBranchId)
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
    if (!formData.title || !formData.location) { toast.error('Please fill required fields'); return; }
    setIsSubmitting(true);
    try {
      const response = await facilitiesAPI.createWorkOrder({ 
        title: formData.title,
        description: formData.description,
        location: formData.location,
        category: formData.category,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        branch_id: activeBranchId 
      });
      if (response.success) {
        toast.success('Work order created successfully');
        setShowModal(false);
        setFormData({ title: '', description: '', location: '', category: 'electrical', priority: 'normal', assigned_to: '' });
        fetchWorkOrders();
      } else { toast.error(response.error || 'Failed to create work order'); }
    } catch (error) { toast.error('Failed to create work order'); }
    finally { setIsSubmitting(false); }
  };

  useEffect(() => {
    if (activeBranchId) fetchWorkOrders();
  }, [activeBranchId]);

  const fetchWorkOrders = async () => {
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getWorkOrders(activeBranchId);
      if (response.success) {
        setWorkOrders(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error('Failed to load work orders');
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      const response = await facilitiesAPI.updateWorkOrderStatus(orderId, status);
      if (response.success) {
        toast.success('Work order updated');
        fetchWorkOrders();
      }
    } catch (error) {
      toast.error('Failed to update work order');
    }
  };

  const getPriorityColor = (_priority?: string) => 'bg-gray-100 text-gray-700 border border-gray-200';

  const getStatusColor = (_status?: string) => 'bg-gray-100 text-gray-700 border border-gray-200';

  const filteredOrders = workOrders.filter(order => {
    const matchesStatus = !filter.status || order.status === filter.status;
    const matchesPriority = !filter.priority || order.priority === filter.priority;
    return matchesStatus && matchesPriority;
  });

  const stats = {
    total: workOrders.length,
    open: workOrders.filter(o => o.status === 'open' || o.status === 'pending').length,
    inProgress: workOrders.filter(o => o.status === 'in_progress').length,
    completed: workOrders.filter(o => o.status === 'completed').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.FACILITIES_MANAGER, UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Work Orders"
        subtitle={`Maintenance work orders for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchWorkOrders} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="primary" onClick={() => setShowModal(true)} leftIcon={<Plus />}>New Work Order</IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Orders</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.open}</p>
              <p className="text-sm text-gray-500">Open</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
              <p className="text-sm text-gray-500">In Progress</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <select
                value={filter.priority}
                onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Priority</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </Card>

          {/* Work Orders List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map(order => (
                <Card key={order.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${getPriorityColor(order.priority)}`}>
                        <Wrench className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{order.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <MapPin className="h-4 w-4" />
                          <span>{order.location}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Assigned to: {order.assigned_to || 'Unassigned'}
                        </p>
                        {order.description && (
                          <p className="text-sm text-gray-400 mt-2">{order.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(order.priority)}`}>
                            {order.priority}
                          </span>
                          {order.category && (
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                              {order.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status?.replace('_', ' ')}
                      </span>
                      <div className="flex gap-2 mt-2">
                        {(order.status === 'open' || order.status === 'pending') && (
                          <IOSButton size="sm" variant="secondary" onClick={() => updateStatus(order.id, 'in_progress')} leftIcon={<Play className="h-4 w-4" />}>
                            Start
                          </IOSButton>
                        )}
                        {order.status === 'in_progress' && (
                          <IOSButton size="sm" variant="primary" onClick={() => updateStatus(order.id, 'completed')} leftIcon={<CheckCircle className="h-4 w-4" />}>
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

          {!isLoading && filteredOrders.length === 0 && (
            <Card className="p-12 text-center">
              <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No work orders found</h3>
              <p className="text-gray-500">Create a new work order or adjust your filters</p>
            </Card>
          )}
        </div>
              <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Work Order</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Issue Title *</Label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., AC not working" />
              </div>
              <div>
                <Label>Location *</Label>
                <select value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">Select location...</option>
                  {rooms.map(room => (
                    <option key={room.id} value={`Room ${room.room_number}`}>Room {room.room_number} - Floor {room.floor}</option>
                  ))}
                  <option value="Lobby">Lobby</option>
                  <option value="Kitchen">Kitchen</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Pool Area">Pool Area</option>
                  <option value="Parking">Parking</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <Label>Category</Label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="electrical">Electrical</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="hvac">HVAC</option>
                  <option value="structural">Structural</option>
                  <option value="appliance">Appliance</option>
                  <option value="other">Other</option>
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
              <div>
                <Label>Description</Label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="Describe the issue..." />
              </div>
              <div className="flex gap-2 justify-end">
                <IOSButton type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</IOSButton>
                <IOSButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Work Order'}</IOSButton>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function WorkOrdersPage() {
  return <WorkOrdersContent />;
}
