'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bed,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  RotateCw,
  User,
  ClipboardCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Package,
  AlertTriangle,
  Camera,
  MessageSquare,
  ChevronRight,
  Filter,
  Search,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import type { HousekeepingTask, RoomStatus } from '@/types/system.types';
import {
  ReportIssueModal,
  UpdateRoomStatusModal,
  InspectionModeModal,
  TaskDetailsModal
} from '@/components/modals/HousekeepingModals';

export default function HousekeepingWorkflows() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'rooms' | 'inspection'>('tasks');
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [showInspectionMode, setShowInspectionMode] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomStatus | null>(null);
  const [issueRoomNumber, setIssueRoomNumber] = useState('');
  const [taskTimer, setTaskTimer] = useState<{ [key: string]: number }>({});
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [roomStatuses, setRoomStatuses] = useState<RoomStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API base URL
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // Fetch tasks and room statuses
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`
        };

        // Fetch tasks
        const tasksResponse = await fetch(`${API_URL}/api/housekeeping/tasks`, {
          headers
        });

        if (!tasksResponse.ok) {
          throw new Error('Failed to fetch tasks');
        }

        const tasksData = await tasksResponse.json();
        setTasks(tasksData.data);

        // Fetch room statuses
        const roomsResponse = await fetch(`${API_URL}/api/housekeeping/rooms`, {
          headers
        });

        if (!roomsResponse.ok) {
          throw new Error('Failed to fetch room statuses');
        }

        const roomsData = await roomsResponse.json();
        setRoomStatuses(roomsData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to load housekeeping data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Auto-assign tasks based on workload
  useEffect(() => {
    const unassignedTasks = tasks.filter((t: HousekeepingTask) => !t.assignedTo && t.status === 'pending');
    if (unassignedTasks.length > 0) {
      // Smart auto-assignment logic would go here
      console.log('Auto-assigning tasks based on workload...');
    }
  }, [tasks]);

  // Timer for active tasks
  useEffect(() => {
    const interval = setInterval(() => {
      setTaskTimer(prev => {
        const updated = { ...prev };
        tasks.forEach((task: HousekeepingTask) => {
          if (task.status === 'in-progress' && task.startedAt) {
            const elapsed = Math.floor((Date.now() - new Date(task.startedAt).getTime()) / 1000);
            updated[task.id] = elapsed;
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [tasks]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'assigned': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'inspected': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'normal': return 'text-blue-600';
      case 'low': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const handleStartTask = (task: HousekeepingTask) => {
    toast.success(`Started cleaning Room ${task.roomNumber}`);
    // Update task status to in-progress
  };

  const handleCompleteTask = (task: HousekeepingTask) => {
    toast.success(`Completed cleaning Room ${task.roomNumber}`);
    // Update task status to completed
  };

  const handleChecklistUpdate = (taskId: string, itemIndex: number) => {
    // Update checklist item
    toast.success('Checklist updated');
  };

  const handleReportIssue = (roomNumber: string, issue: string) => {
    toast.warning(`Issue reported for Room ${roomNumber}: ${issue}`);
  };

  const stats = {
    totalTasks: tasks.length,
    completedToday: tasks.filter((t: HousekeepingTask) => t.completedAt && new Date(t.completedAt).toISOString().startsWith(new Date().toISOString().slice(0, 10))).length,
    inProgress: tasks.filter((t: HousekeepingTask) => t.status === 'in-progress').length,
    pending: tasks.filter((t: HousekeepingTask) => t.status === 'pending').length,
    avgCleaningTime: 35,
    roomsInspected: 8,
    suppliesLow: 2,
    efficiency: 92
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Housekeeping Workflows</h1>
              <p className="text-gray-600 mt-1">Automated task management with real-time tracking</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowReportIssue(true)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Report Issue
              </button>
              <button 
                onClick={() => setShowInspectionMode(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Inspection Mode
              </button>
            </div>
          </div>

          {/* Stats Grid with AI Predictions */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg p-4 border border-gray-100"
            >
              <ClipboardCheck className="h-8 w-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{stats.totalTasks}</p>
              <p className="text-sm text-gray-600">Total Tasks</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-green-50 border border-green-200 rounded-lg p-4"
            >
              <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-900">{stats.completedToday}</p>
              <p className="text-sm text-green-700">Completed</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-blue-50 border border-blue-200 rounded-lg p-4"
            >
              <Play className="h-8 w-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-blue-900">{stats.inProgress}</p>
              <p className="text-sm text-blue-700">In Progress</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
            >
              <Clock className="h-8 w-8 text-yellow-600 mb-2" />
              <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
              <p className="text-sm text-yellow-700">Pending</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-lg p-4 border border-gray-100"
            >
              <Timer className="h-8 w-8 text-purple-600 mb-2" />
              <p className="text-2xl font-bold">{stats.avgCleaningTime}m</p>
              <p className="text-sm text-gray-600">Avg Time</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-purple-50 border border-purple-200 rounded-lg p-4"
            >
              <Sparkles className="h-8 w-8 text-purple-600 mb-2" />
              <p className="text-2xl font-bold text-purple-900">{stats.roomsInspected}</p>
              <p className="text-sm text-purple-700">Inspected</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-orange-50 border border-orange-200 rounded-lg p-4"
            >
              <Package className="h-8 w-8 text-orange-600 mb-2" />
              <p className="text-2xl font-bold text-orange-900">{stats.suppliesLow}</p>
              <p className="text-sm text-orange-700">Low Supplies</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg p-4"
            >
              <TrendingUp className="h-8 w-8 mb-2" />
              <p className="text-2xl font-bold">{stats.efficiency}%</p>
              <p className="text-sm opacity-90">Efficiency</p>
            </motion.div>
          </div>

          {/* AI Prediction Alert */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-4 text-white"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">AI Prediction</p>
                <p className="text-sm opacity-90">
                  Based on current occupancy, expect 15 check-outs by 2 PM. Recommend assigning 2 additional staff to handle peak load.
                </p>
              </div>
              <button className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30">
                Apply Suggestion
              </button>
            </div>
          </motion.div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {['tasks', 'rooms', 'inspection'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab === 'inspection' ? 'Inspection Queue' : tab}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          {activeTab === 'tasks' && (
            <>
              {/* Filters */}
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by room number..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Task Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map(task => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className={`p-4 border-b ${
                      task.priority === 'urgent' ? 'bg-red-50 border-red-200' :
                      task.priority === 'high' ? 'bg-orange-50 border-orange-200' :
                      'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Bed className="h-5 w-5 text-gray-600" />
                          <span className="font-bold text-lg">Room {task.roomNumber}</span>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 capitalize">{task.taskType.replace('-', ' ')}</span>
                        <span className={`font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority} priority
                        </span>
                      </div>
                    </div>

                    <div className="p-4">
                      {task.status === 'in-progress' && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Progress</span>
                            <span className="text-sm font-medium">
                              {formatTime(taskTimer[task.id] || 0)} / {task.estimatedDuration}m
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min(
                                  ((taskTimer[task.id] || 0) / (task.estimatedDuration * 60)) * 100,
                                  100
                                )}%`
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 mb-4">
                        <p className="text-sm font-medium text-gray-700">Checklist ({task.checklist.filter(c => c.completed).length}/{task.checklist.length})</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {task.checklist.slice(0, 3).map((item, index) => (
                            <label key={index} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => handleChecklistUpdate(task.id, index)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className={item.completed ? 'line-through text-gray-400' : 'text-gray-700'}>
                                {item.item}
                              </span>
                            </label>
                          ))}
                          {task.checklist.length > 3 && (
                            <p className="text-xs text-gray-500">+{task.checklist.length - 3} more items</p>
                          )}
                        </div>
                      </div>

                      {task.notes && (
                        <div className="mb-4 p-2 bg-yellow-50 rounded-lg">
                          <p className="text-xs text-yellow-800">
                            <AlertCircle className="inline h-3 w-3 mr-1" />
                            {task.notes}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {task.status === 'assigned' && (
                          <button
                            onClick={() => handleStartTask(task)}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                          >
                            <Play className="h-4 w-4" />
                            Start
                          </button>
                        )}
                        {task.status === 'in-progress' && (
                          <>
                            <button className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-2">
                              <Pause className="h-4 w-4" />
                              Pause
                            </button>
                            <button
                              onClick={() => handleCompleteTask(task)}
                              className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Complete
                            </button>
                          </>
                        )}
                        {task.status === 'pending' && (
                          <button className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                            Assign to Me
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskDetails(true);
                          }}
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'rooms' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Room Status Board</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {roomStatuses.map(room => (
                  <div key={room.roomId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-lg">Room {room.roomNumber}</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
                        room.currentStatus === 'clean' ? 'bg-green-100 text-green-800 border-green-200' :
                        room.currentStatus === 'dirty' ? 'bg-red-100 text-red-800 border-red-200' :
                        room.currentStatus === 'inspected' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        'bg-gray-100 text-gray-800 border-gray-200'
                      }`}>
                        {room.currentStatus}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      {room.lastCleaned && (
                        <p className="text-gray-600">
                          Last cleaned: {new Date(room.lastCleaned).toLocaleTimeString()}
                        </p>
                      )}
                      {room.lastInspected && (
                        <p className="text-gray-600">
                          Last inspected: {new Date(room.lastInspected).toLocaleTimeString()}
                        </p>
                      )}
                      {room.issues.length > 0 && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded">
                          <p className="text-xs font-medium text-yellow-800">Issues:</p>
                          {room.issues.map((issue, idx) => (
                            <p key={idx} className="text-xs text-yellow-700">• {issue.description}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedRoom(room);
                          setShowUpdateStatus(true);
                        }}
                        className="flex-1 px-2 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                        Update Status
                      </button>
                      <button
                        onClick={() => {
                          setIssueRoomNumber(room.roomNumber);
                          setShowReportIssue(true);
                        }}
                        className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200">
                        Report Issue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'inspection' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="text-center text-gray-500">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4" />
                <p>Inspection Queue</p>
                <p className="text-sm mt-2">Rooms ready for quality inspection</p>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <ReportIssueModal 
          isOpen={showReportIssue} 
          onClose={() => {
            setShowReportIssue(false);
            setIssueRoomNumber('');
          }}
          roomNumber={issueRoomNumber}
        />
        <InspectionModeModal 
          isOpen={showInspectionMode} 
          onClose={() => setShowInspectionMode(false)}
        />
        <UpdateRoomStatusModal 
          isOpen={showUpdateStatus} 
          onClose={() => {
            setShowUpdateStatus(false);
            setSelectedRoom(null);
          }}
          room={selectedRoom}
        />
        <TaskDetailsModal 
          isOpen={showTaskDetails} 
          onClose={() => {
            setShowTaskDetails(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
