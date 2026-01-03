'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { Card } from '@/components/ui/minimal/card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { facilitiesAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import Link from 'next/link';
import { 
  Bed, RefreshCw, ClipboardList, ChevronRight, Users,
  Wrench, CheckSquare, Brush, ShieldCheck, Package, AlertCircle, 
  Search, Microscope, Home, Key, LayoutDashboard, Glasses, UserCheck, Calendar
} from 'lucide-react';

// Main component
function FacilitiesManagerDashboardContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [stats, setStats] = useState({
    rooms: {
      total: 0,
      clean: 0,
      dirty: 0,
      outOfOrder: 0,
      inspected: 0
    },
    tasks: {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0
    },
    workOrders: {
      total: 0,
      open: 0,
      inProgress: 0,
      completed: 0
    },
    staff: {
      housekeeping: 0,
      maintenance: 0,
      onDuty: 0
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [recentWorkOrders, setRecentWorkOrders] = useState<any[]>([]);

  useEffect(() => {
    if (activeBranchId) {
      fetchDashboardData();
    }
  }, [activeBranchId]);

  const fetchDashboardData = async () => {
    if (!activeBranchId) return;
    
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getDashboard(activeBranchId);
      
      if (response.success) {
        setStats(response.data?.stats || stats);
        setRecentTasks(response.data?.recentTasks || []);
        setRecentWorkOrders(response.data?.recentWorkOrders || []);
      }
    } catch (error) {
      console.error('Error fetching facilities dashboard data:', error);
      toast.error('Failed to load dashboard data');
      
      // Show empty state on error
      setRecentTasks([]);
      setRecentWorkOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickLinks = [
    { href: '/dashboard/facilities/housekeeping/tasks', icon: ClipboardList, label: 'Housekeeping Tasks', color: 'bg-blue-50 text-blue-600' },
    { href: '/dashboard/facilities/maintenance/work-orders', icon: Wrench, label: 'Work Orders', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/facilities/rooms', icon: Bed, label: 'Room Status', color: 'bg-green-50 text-green-600' },
    { href: '/dashboard/facilities/housekeeping/inspections', icon: CheckSquare, label: 'Inspections', color: 'bg-yellow-50 text-yellow-600' },
    { href: '/dashboard/facilities/staff-management', icon: Users, label: 'Staff', color: 'bg-pink-50 text-pink-600' },
    { href: '/dashboard/facilities/inventory', icon: Package, label: 'Supplies', color: 'bg-indigo-50 text-indigo-600' },
    { href: '/dashboard/facilities/quality-compliance', icon: ShieldCheck, label: 'Compliance', color: 'bg-amber-50 text-amber-600' },
    { href: '/dashboard/facilities/maintenance/assets', icon: Home, label: 'Assets', color: 'bg-cyan-50 text-cyan-600' },
  ];
  
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
      case 'urgent':
        return 'text-red-600';
      case 'medium':
        return 'text-orange-600';
      default:
        return 'text-blue-600';
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase().replace('_', '')) {
      case 'completed':
        return 'text-green-600';
      case 'inprogress':
        return 'text-blue-600';
      case 'open':
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.FACILITIES_MANAGER,
      UserRole.HOUSEKEEPING,
      UserRole.MAINTENANCE,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER
    ]}>
      <BranchAwareDashboardLayout
        title="Facilities Management"
        subtitle={`Housekeeping and maintenance for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton variant="secondary" onClick={fetchDashboardData} leftIcon={<RefreshCw />}>
            Refresh
          </IOSButton>
        }
      >
        <div className="space-y-6">
          {/* Room Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <IOSCard className="p-4">
              <Bed className="h-5 w-5 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">Total Rooms</p>
              <p className="text-lg font-bold">{stats.rooms.total}</p>
            </IOSCard>
            
            <IOSCard className="p-4">
              <Brush className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-500">Clean</p>
              <p className="text-lg font-bold text-green-600">{stats.rooms.clean}</p>
            </IOSCard>
            
            <IOSCard className="p-4">
              <Search className="h-5 w-5 text-yellow-600 mb-2" />
              <p className="text-sm text-gray-500">Dirty</p>
              <p className="text-lg font-bold text-yellow-600">{stats.rooms.dirty}</p>
            </IOSCard>
            
            <IOSCard className="p-4">
              <Glasses className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-gray-500">Inspected</p>
              <p className="text-lg font-bold text-blue-600">{stats.rooms.inspected}</p>
            </IOSCard>
            
            <IOSCard className="p-4">
              <AlertCircle className="h-5 w-5 text-red-600 mb-2" />
              <p className="text-sm text-gray-500">Out of Order</p>
              <p className="text-lg font-bold text-red-600">{stats.rooms.outOfOrder}</p>
            </IOSCard>
          </div>

          {/* Task & Work Order Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Housekeeping</h3>
                <Link href="/dashboard/facilities/housekeeping/tasks">
                  <IOSButton variant="ghost" size="sm">View</IOSButton>
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Pending Tasks</p>
                  <p className="font-bold text-yellow-600">{stats.tasks.pending}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">In Progress</p>
                  <p className="font-bold text-blue-600">{stats.tasks.inProgress}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Completed Today</p>
                  <p className="font-bold text-green-600">{stats.tasks.completed}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Maintenance</h3>
                <Link href="/dashboard/facilities/maintenance/work-orders">
                  <IOSButton variant="ghost" size="sm">View</IOSButton>
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Open Work Orders</p>
                  <p className="font-bold text-yellow-600">{stats.workOrders.open}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">In Progress</p>
                  <p className="font-bold text-blue-600">{stats.workOrders.inProgress}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Completed Today</p>
                  <p className="font-bold text-green-600">{stats.workOrders.completed}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Staff</h3>
                <Link href="/dashboard/facilities/staff-management">
                  <IOSButton variant="ghost" size="sm">View</IOSButton>
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Housekeeping Staff</p>
                  <p className="font-bold">{stats.staff.housekeeping}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Maintenance Staff</p>
                  <p className="font-bold">{stats.staff.maintenance}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">On Duty Today</p>
                  <p className="font-bold text-green-600">{stats.staff.onDuty}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Quick Links */}
          <IOSCard className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold font-sf-pro-display">Quick Access</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none transition cursor-pointer text-center ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-6 w-6 mx-auto mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="text-sm font-medium">{link.label}</p>
                  </IOSCard>
                </Link>
              ))}
            </div>
          </IOSCard>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Tasks */}
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold font-sf-pro-display">Recent Housekeeping Tasks</h3>
                <Link href="/dashboard/facilities/housekeeping/tasks">
                  <IOSButton variant="ghost" size="sm">
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </IOSButton>
                </Link>
              </div>
              
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                </div>
              ) : recentTasks.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No recent tasks</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTasks.map((task) => (
                    <div key={task.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between">
                        <div>
                          <div className="flex items-center">
                            <p className="font-medium">Room {task.room_number}</p>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">{task.task_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-700">Assigned: {task.assigned_to}</p>
                          <p className={`text-xs ${getStatusColor(task.status)}`}>{task.status.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </IOSCard>

            {/* Recent Work Orders */}
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold font-sf-pro-display">Recent Work Orders</h3>
                <Link href="/dashboard/facilities/maintenance/work-orders">
                  <IOSButton variant="ghost" size="sm">
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </IOSButton>
                </Link>
              </div>
              
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                  <div className="h-16 bg-gray-100 rounded-lg"></div>
                </div>
              ) : recentWorkOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Wrench className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No recent work orders</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentWorkOrders.map((order) => (
                    <div key={order.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between">
                        <div>
                          <div className="flex items-center">
                            <p className="font-medium">{order.location}</p>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 ${getPriorityColor(order.priority)}`}>
                              {order.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">{order.issue}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-700">Assigned: {order.assigned_to}</p>
                          <p className={`text-xs ${getStatusColor(order.status)}`}>{order.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </IOSCard>
          </div>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

// Export wrapped dashboard to prevent hydration errors
export default function FacilitiesManagerDashboard() {
  return (
    <BranchPageWrapper>
      <FacilitiesManagerDashboardContent />
    </BranchPageWrapper>
  );
}
