'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import {
  Home,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Package,
  ClipboardList,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { housekeepingAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function HousekeepingDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
    urgent: 0
  });
  const [roomTasks, setRoomTasks] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const tasksRes = await housekeepingAPI.getTasks().catch(() => ({ tasks: [] }));
      const taskList = tasksRes.tasks || tasksRes || [];

      if (Array.isArray(taskList)) {
        const pending = taskList.filter((t: any) => t.status === 'pending').length;
        const inProgress = taskList.filter((t: any) => t.status === 'in_progress').length;
        const completed = taskList.filter((t: any) => t.status === 'completed').length;
        const urgent = taskList.filter((t: any) => t.priority === 'urgent').length;

        setTasks({ pending, inProgress, completed, urgent });
        setRoomTasks(taskList.slice(0, 10).map((t: any) => ({
          id: t.id,
          room: t.room_number || '-',
          type: t.task_type || 'Cleaning',
          priority: t.priority || 'Normal',
          status: t.status || 'pending'
        })));
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Housekeeping Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Welcome, {user?.firstName}! Here are your tasks for today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Clock className="h-8 w-8 text-yellow-600" />
                <span className="text-2xl font-bold text-yellow-900">{tasks.pending}</span>
              </div>
              <p className="text-sm text-yellow-700 mt-2">Pending Tasks</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Sparkles className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold text-blue-900">{tasks.inProgress}</span>
              </div>
              <p className="text-sm text-blue-700 mt-2">In Progress</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <span className="text-2xl font-bold text-green-900">{tasks.completed}</span>
              </div>
              <p className="text-sm text-green-700 mt-2">Completed Today</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <AlertCircle className="h-8 w-8 text-red-600" />
                <span className="text-2xl font-bold text-red-900">{tasks.urgent}</span>
              </div>
              <p className="text-sm text-red-700 mt-2">Urgent Tasks</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Room Tasks</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {roomTasks.map(task => (
                    <tr key={task.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">Room {task.room}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{task.type}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          task.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                          task.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                          task.priority === 'Normal' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          task.status === 'completed' ? 'bg-green-100 text-green-800' :
                          task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {task.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                          Start Task
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4">
                <button className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                  <CheckCircle className="h-6 w-6 text-green-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Complete Task</span>
                </button>
                <button className="p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                  <AlertCircle className="h-6 w-6 text-yellow-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Report Issue</span>
                </button>
                <button className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  <Package className="h-6 w-6 text-blue-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Request Supplies</span>
                </button>
                <button className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <ClipboardList className="h-6 w-6 text-purple-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">View Schedule</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Supply Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Towels</span>
                  <span className="text-sm font-medium text-green-600">Sufficient</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Toiletries</span>
                  <span className="text-sm font-medium text-yellow-600">Low</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Cleaning Supplies</span>
                  <span className="text-sm font-medium text-green-600">Sufficient</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Bed Linens</span>
                  <span className="text-sm font-medium text-red-600">Critical</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
