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
  Users,
  Sparkles,
  TrendingUp,
  Package,
  Plus,
  Edit2,
  Trash2,
  MoreHorizontal,
  Search,
  Filter,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ReportIssueModal,
  UpdateRoomStatusModal,
  InspectionModeModal
} from '@/components/modals/HousekeepingModals';
import { housekeepingAPI, storeAPI } from '@/lib/api';

export default function AdminHousekeepingPage() {
  const { user } = useAuth();
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'in-progress' | 'pending'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const [stats, setStats] = useState({
    totalRooms: 0,
    cleanedToday: 0,
    inProgress: 0,
    pending: 0,
    staffOnDuty: 0,
    averageCleanTime: '-'
  });

  const [housekeepingTasks, setHousekeepingTasks] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tasksRes, roomsRes] = await Promise.all([
        housekeepingAPI.getTasks().catch(() => ({ tasks: [] })),
        housekeepingAPI.getRoomStatus().catch(() => ({ rooms: [] }))
      ]);

      const tasks = tasksRes.tasks || tasksRes || [];
      const rooms = roomsRes.rooms || roomsRes || [];

      if (Array.isArray(tasks)) {
        const completed = tasks.filter((t: any) => t.status === 'completed').length;
        const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
        const pending = tasks.filter((t: any) => t.status === 'pending').length;

        setStats({
          totalRooms: Array.isArray(rooms) ? rooms.length : 0,
          cleanedToday: completed,
          inProgress,
          pending,
          staffOnDuty: 0,
          averageCleanTime: '-'
        });

        setHousekeepingTasks(tasks.slice(0, 20).map((t: any) => ({
          id: t.id,
          room: t.room_number || '-',
          type: t.task_type || 'Cleaning',
          assignedTo: t.assigned_to || '-',
          status: t.status || 'pending',
          time: t.duration || '-'
        })));
      }
    } catch (error) {
      console.error('Error fetching housekeeping data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Housekeeping Management</h1>
            <p className="text-gray-600 mt-1">Monitor and manage housekeeping operations</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <Home className="h-8 w-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{stats.totalRooms}</p>
              <p className="text-sm text-gray-600">Total Rooms</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-900">{stats.cleanedToday}</p>
              <p className="text-sm text-green-700">Cleaned Today</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <Clock className="h-8 w-8 text-yellow-600 mb-2" />
              <p className="text-2xl font-bold text-yellow-900">{stats.inProgress}</p>
              <p className="text-sm text-yellow-700">In Progress</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertCircle className="h-8 w-8 text-red-600 mb-2" />
              <p className="text-2xl font-bold text-red-900">{stats.pending}</p>
              <p className="text-sm text-red-700">Pending</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <Users className="h-8 w-8 text-purple-600 mb-2" />
              <p className="text-2xl font-bold">{stats.staffOnDuty}</p>
              <p className="text-sm text-gray-600">Staff on Duty</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <TrendingUp className="h-8 w-8 text-indigo-600 mb-2" />
              <p className="text-2xl font-bold">{stats.averageCleanTime}</p>
              <p className="text-sm text-gray-600">Avg Clean Time</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tasks Table */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Tasks</h2>
              <div className="overflow-x-auto">
                {/* Search and Filters */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search tasks..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div className="relative">
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as 'all' | 'completed' | 'in-progress' | 'pending')}
                      className="appearance-none pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="all">All Status</option>
                      <option value="completed">Completed</option>
                      <option value="in-progress">In Progress</option>
                      <option value="pending">Pending</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                  <button
                    onClick={() => setShowIssueModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="h-5 w-5" />
                    Report Issue
                  </button>
                </div>

                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {housekeepingTasks
                      .filter(task => 
                        (filterStatus === 'all' || task.status === filterStatus) &&
                        (searchTerm === '' ||
                          task.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()))
                      )
                      .map(task => (
                        <tr key={task.id}>
                          <td className="px-4 py-3 text-sm font-medium">Room {task.room}</td>
                          <td className="px-4 py-3 text-sm">{task.type}</td>
                          <td className="px-4 py-3 text-sm">{task.assignedTo}</td>
                          <td className="px-4 py-3">
                            <span className={'inline-flex px-2 py-1 text-xs font-medium rounded-full ' + (task.status === 'completed' ? 'bg-green-100 text-green-800' : task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800')}>
                              {task.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{task.time || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedRoom({ roomNumber: task.room });
                                  setShowStatusModal(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRoom({ roomNumber: task.room });
                                  setShowInspectionModal(true);
                                }}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Supplies Status */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Supply Inventory</h2>
              <div className="space-y-4">
                {supplies.map(supply => (
                  <div key={supply.item} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{supply.item}</span>
                      <span className={`text-sm font-medium ${
                        supply.status === 'sufficient' ? 'text-green-600' :
                        supply.status === 'low' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {supply.quantity} units
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          supply.status === 'sufficient' ? 'bg-green-500' :
                          supply.status === 'low' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${(supply.quantity / (supply.threshold * 3)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => toast.info('Opening supply order form...')}
                className="w-full mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
              >
                <Package className="h-4 w-4 inline mr-2" />
                Order Supplies
              </button>

              {/* Housekeeping Modals */}
              <ReportIssueModal
                isOpen={showIssueModal}
                onClose={() => setShowIssueModal(false)}
              />
              <UpdateRoomStatusModal
                isOpen={showStatusModal}
                onClose={() => {
                  setShowStatusModal(false);
                  setSelectedRoom(null);
                }}
                room={selectedRoom}
              />
              <InspectionModeModal
                isOpen={showInspectionModal}
                onClose={() => {
                  setShowInspectionModal(false);
                  setSelectedRoom(null);
                }}
                room={selectedRoom}
              />
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
