'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { maintenanceAPI } from '@/lib/api';
import { Wrench, RefreshCw, Plus, Clock, CheckCircle, AlertTriangle, Calendar, ClipboardList, Settings, Search, Filter, Eye } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { NewWorkOrderModal, ViewWorkOrderModal, WorkOrderFormData } from '@/components/modals/MaintenanceModals';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface WorkOrder { 
  id: string; 
  title: string; 
  description?: string;
  location: string; 
  priority: string; 
  status: string; 
  category?: string;
  created_at: string; 
  completed_at?: string;
  assigned_to?: string;
  branch_id?: number; 
}

export default function MaintenanceDashboard() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0, urgent: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await maintenanceAPI.getRequests(activeBranchId || undefined);
      if (response.success) {
        const data = response.data || [];
        setOrders(data.slice(0, 10));
        setStats({
          pending: data.filter((o: WorkOrder) => o.status === 'pending').length,
          inProgress: data.filter((o: WorkOrder) => o.status === 'in_progress').length,
          completed: data.filter((o: WorkOrder) => o.status === 'completed').length,
          urgent: data.filter((o: WorkOrder) => o.priority === 'urgent').length,
        });
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [activeBranchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await maintenanceAPI.updateRequest(id, { status });
      toast.success('Status updated');
      fetchData();
      setShowViewModal(false);
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleCreateOrder = async (data: WorkOrderFormData) => {
    try {
      await maintenanceAPI.createRequest({
        ...data,
        branch_id: activeBranchId || undefined,
      });
      fetchData();
    } catch (error: any) {
      throw error;
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      await maintenanceAPI.deleteRequest(orderToDelete);
      toast.success('Work order deleted');
      fetchData();
      setShowDeleteConfirm(false);
      setOrderToDelete(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const priorityColors: Record<string, string> = { urgent: 'bg-red-500', high: 'bg-orange-500', normal: 'bg-sky-500', low: 'bg-stone-400' };
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
    in_progress: { label: 'In Progress', color: 'text-sky-700', bg: 'bg-sky-100' },
    completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  };

  const statCards = [
    { label: 'Pending', value: stats.pending, icon: Clock },
    { label: 'In Progress', value: stats.inProgress, icon: Wrench },
    { label: 'Completed', value: stats.completed, icon: CheckCircle },
    { label: 'Urgent', value: stats.urgent, icon: AlertTriangle },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Maintenance</h1>
              <p className="text-stone-500 mt-0.5">Manage work orders and assets</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchData} disabled={isLoading} className="btn-secondary">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button onClick={() => setShowNewOrderModal(true)} className="btn-primary">
                <Plus className="h-4 w-4" />
                <span>New Order</span>
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map((stat, i) => (
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
            {/* Recent Work Orders */}
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-stone-900">Work Orders</h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-[12px] w-32 bg-stone-50 border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-300 focus:border-stone-300"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded-lg"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-stone-400" /></div>
              ) : orders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Wrench className="h-6 w-6 text-stone-400" /></div>
                  <p className="empty-state-title">No work orders</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                  {filteredOrders.map((order) => {
                    const status = statusConfig[order.status] || statusConfig.pending;
                    return (
                      <div 
                        key={order.id} 
                        className="p-3 bg-stone-50 rounded-lg flex items-center justify-between hover:bg-stone-100 transition-colors cursor-pointer group"
                        onClick={() => { setSelectedOrder(order); setShowViewModal(true); }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${priorityColors[order.priority] || priorityColors.normal}`} />
                          <div>
                            <p className="text-[13px] font-medium text-stone-800">{order.title}</p>
                            <p className="text-[11px] text-stone-500">{order.location}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setShowViewModal(true); }}
                            className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 bg-stone-200 hover:bg-stone-300 transition-all"
                          >
                            <Eye className="h-3 w-3 text-stone-600" />
                          </button>
                          {order.status === 'pending' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, 'in_progress'); }} 
                              className="text-[11px] font-medium px-2 py-1 bg-stone-200 hover:bg-stone-300 rounded-md transition-colors"
                            >
                              Start
                            </button>
                          )}
                          {order.status === 'in_progress' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, 'completed'); }} 
                              className="text-[11px] font-medium px-2 py-1 bg-emerald-500 text-white hover:bg-emerald-600 rounded-md transition-colors"
                            >
                              Done
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredOrders.length === 0 && !isLoading && (
                    <div className="text-center py-8 text-stone-500 text-sm">
                      {searchQuery || statusFilter !== 'all' ? 'No matching work orders' : 'No work orders yet'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="card-elevated p-5">
              <h2 className="text-[15px] font-semibold text-stone-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: '/dashboard/maintenance/orders', icon: ClipboardList, label: 'Work Orders' },
                  { href: '/dashboard/maintenance/assets', icon: Settings, label: 'Assets' },
                  { href: '/dashboard/maintenance/schedule', icon: Calendar, label: 'Schedule' },
                ].map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div className="action-card group">
                      <div className="action-card-icon">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <p className="action-card-label">{item.label}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>

        {/* Modals */}
        <NewWorkOrderModal
          isOpen={showNewOrderModal}
          onClose={() => setShowNewOrderModal(false)}
          onSubmit={handleCreateOrder}
          branchId={activeBranchId || undefined}
        />

        <ViewWorkOrderModal
          isOpen={showViewModal}
          onClose={() => { setShowViewModal(false); setSelectedOrder(null); }}
          workOrder={selectedOrder}
          onUpdateStatus={handleUpdateStatus}
        />

        <ConfirmationDialog
          isOpen={showDeleteConfirm}
          onClose={() => { setShowDeleteConfirm(false); setOrderToDelete(null); }}
          onConfirm={handleDeleteOrder}
          title="Delete Work Order"
          message="Are you sure you want to delete this work order? This action cannot be undone."
          type="danger"
          confirmText="Delete"
        />
    </ProtectedRoute>
  );
}
