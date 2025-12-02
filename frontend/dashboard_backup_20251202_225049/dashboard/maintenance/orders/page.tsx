'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { maintenanceAPI } from '@/lib/api';
import { Wrench, Plus, RefreshCw, Search, Clock, CheckCircle, Play, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface WorkOrder { id: string; title: string; description?: string; location: string; priority: string; status: string; created_at: string; assigned_to?: string; }

const priorityOptions = ['urgent', 'high', 'normal', 'low'];
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
};

export default function MaintenanceOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', location: '', priority: 'normal' });

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await maintenanceAPI.getRequests(undefined, statusFilter !== 'all' ? statusFilter : undefined);
      if (response.success) setOrders(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filteredOrders = orders.filter((o) => o.title?.toLowerCase().includes(searchQuery.toLowerCase()) || o.location?.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreateOrder = async () => {
    if (!formData.title || !formData.location) { toast.error('Fill required fields'); return; }
    try {
      await maintenanceAPI.createRequest(formData);
      toast.success('Work order created');
      setAddModalOpen(false);
      setFormData({ title: '', description: '', location: '', priority: 'normal' });
      fetchOrders();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await maintenanceAPI.updateRequest(id, { status });
      toast.success('Status updated');
      fetchOrders();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const priorityColors: Record<string, string> = { urgent: 'bg-red-500', high: 'bg-orange-500', normal: 'bg-blue-500', low: 'bg-gray-500' };

  return (
    <ProtectedRoute allowedRoles={[UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Work Orders</h1><p className="text-gray-500">Manage maintenance requests</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchOrders}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Order</IOSButton>
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2">
                {['all', 'pending', 'in_progress', 'completed'].map((status) => (
                  <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredOrders.length === 0 ? (
            <IOSCard className="p-12 text-center"><Wrench className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No work orders</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const status = statusConfig[order.status] || statusConfig.pending;
                return (
                  <IOSCard key={order.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-full min-h-[40px] rounded ${priorityColors[order.priority] || priorityColors.normal}`} />
                        <div>
                          <p className="font-bold">{order.title}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> {order.location}</p>
                          {order.description && <p className="text-sm text-gray-400 mt-1">{order.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                        {order.status === 'pending' && <IOSButton size="sm" onClick={() => handleUpdateStatus(order.id, 'in_progress')}><Play className="h-4 w-4 mr-1" /> Start</IOSButton>}
                        {order.status === 'in_progress' && <IOSButton size="sm" onClick={() => handleUpdateStatus(order.id, 'completed')}><CheckCircle className="h-4 w-4 mr-1" /> Done</IOSButton>}
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Work Order</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Title *</label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., Fix AC in Room 101" /></div>
              <div><label className="text-sm font-medium">Location *</label><Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., Room 101" /></div>
              <div><label className="text-sm font-medium">Priority</label>
                <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  {priorityOptions.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full p-2 border rounded-ios-lg" rows={3} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleCreateOrder} className="flex-1">Create</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
