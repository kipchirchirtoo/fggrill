'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import {
  Wrench,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  Calendar,
  TrendingUp,
  Settings,
  RefreshCw
} from 'lucide-react';
import { maintenanceAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function MaintenanceDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    openTickets: 0,
    inProgress: 0,
    completed: 0,
    urgent: 0,
    scheduledToday: 0,
    equipmentStatus: 0
  });
  const [workOrders, setWorkOrders] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const requestsRes = await maintenanceAPI.getRequests().catch(() => ({ requests: [] }));
      const requests = requestsRes.requests || requestsRes || [];

      if (Array.isArray(requests)) {
        const openTickets = requests.filter((r: any) => r.status !== 'completed').length;
        const inProgress = requests.filter((r: any) => r.status === 'in_progress').length;
        const completed = requests.filter((r: any) => r.status === 'completed').length;
        const urgent = requests.filter((r: any) => r.priority === 'urgent').length;

        setStats({
          openTickets,
          inProgress,
          completed,
          urgent,
          scheduledToday: requests.filter((r: any) => r.scheduled_date === new Date().toISOString().split('T')[0]).length,
          equipmentStatus: 100 - (urgent * 5)
        });

        setWorkOrders(requests.slice(0, 10).map((r: any) => ({
          id: r.id || r.ticket_number || '-',
          location: r.location || r.room || '-',
          issue: r.description || r.issue || '-',
          priority: r.priority || 'normal',
          status: r.status || 'pending'
        })));
      }
    } catch (error) {
      console.error('Error fetching maintenance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <ProtectedRoute allowedRoles={[UserRole.MAINTENANCE]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Maintenance Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Welcome, {user?.firstName}! Manage work orders and equipment maintenance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertCircle className="h-8 w-8 text-red-600 mb-2" />
              <p className="text-2xl font-bold text-red-900">{stats.urgent}</p>
              <p className="text-sm text-red-700">Urgent</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <Clock className="h-8 w-8 text-yellow-600 mb-2" />
              <p className="text-2xl font-bold text-yellow-900">{stats.openTickets}</p>
              <p className="text-sm text-yellow-700">Open Tickets</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <Wrench className="h-8 w-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-blue-900">{stats.inProgress}</p>
              <p className="text-sm text-blue-700">In Progress</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
              <p className="text-sm text-green-700">Completed</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <Calendar className="h-8 w-8 text-purple-600 mb-2" />
              <p className="text-2xl font-bold">{stats.scheduledToday}</p>
              <p className="text-sm text-gray-600">Scheduled Today</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <TrendingUp className="h-8 w-8 text-indigo-600 mb-2" />
              <p className="text-2xl font-bold">{stats.equipmentStatus}%</p>
              <p className="text-sm text-gray-600">Equipment Health</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Work Orders</h2>
              <div className="space-y-3">
                {workOrders.map(order => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900">{order.id}</span>
                        <span className="ml-2 text-sm text-gray-600">{order.location}</span>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        order.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{order.issue}</p>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                      <button className="text-sm text-indigo-600 hover:text-indigo-700">
                        View Details →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4">
                <button className="p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                  <AlertCircle className="h-6 w-6 text-red-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Report Issue</span>
                </button>
                <button className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  <Wrench className="h-6 w-6 text-blue-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">New Work Order</span>
                </button>
                <button className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                  <CheckCircle className="h-6 w-6 text-green-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Complete Task</span>
                </button>
                <button className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <Package className="h-6 w-6 text-purple-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Parts Inventory</span>
                </button>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  <span className="text-sm font-medium text-yellow-800">Scheduled Maintenance</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">Generator inspection due tomorrow</p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
