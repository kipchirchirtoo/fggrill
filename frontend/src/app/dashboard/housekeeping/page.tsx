'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Home, Clock, CheckCircle, AlertCircle, Sparkles, Package, ClipboardList,
  XCircle, RefreshCw, Bed, Play, Pause, Eye, Wrench, Star, TrendingUp,
  User, Calendar, Timer, Search, Filter, ChevronRight, Bell, Trash2,
  SprayCan, Wind, Sun, Moon, Coffee, Bath, Wifi, Key, Users, Award,
  BarChart3, ArrowUpRight, ArrowDownRight, Plus, X, Check, AlertTriangle,
  UserPlus, UserCheck, Send, ShoppingCart, Minus
} from 'lucide-react';
import { housekeepingAPI, roomsAPI, staffAPI, storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

// Room status types
type RoomStatus = 'clean' | 'dirty' | 'cleaning' | 'inspecting' | 'maintenance' | 'occupied' | 'checkout';

interface Room {
  id: string;
  room_number: string;
  floor: number;
  type: string;
  status: RoomStatus;
  guest_name?: string;
  checkout_time?: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  assigned_to?: string;
  notes?: string;
}

interface Task {
  id: string;
  room_number: string;
  room_id?: string;
  task_type: string;
  priority: string;
  status: string;
  assigned_to?: string;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
}

interface Supply {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  min_level: number;
  unit: string;
  category?: string;
  status: 'sufficient' | 'low' | 'critical';
}

interface Housekeeper {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'off-duty';
  current_task?: string;
  tasks_completed: number;
  avatar?: string;
}

interface SupplyRequest {
  item_sku: string;
  item_name: string;
  quantity: number;
  current_stock?: number;
}

export default function HousekeepingDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'rooms' | 'tasks' | 'supplies' | 'team'>('overview');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isRequestSupplyModalOpen, setIsRequestSupplyModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Supervisor check
  const isSupervisor = user?.role === UserRole.HOUSEKEEPING_SUPERVISOR || 
                       user?.role === UserRole.SUPER_ADMIN || 
                       user?.role === UserRole.GENERAL_MANAGER ||
                       user?.role === UserRole.BRANCH_MANAGER;
  
  // Team members (for supervisor)
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [selectedHousekeeper, setSelectedHousekeeper] = useState<string>('');
  
  // Supply request state
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>([]);
  const [requestNotes, setRequestNotes] = useState('');
  
  // New task form state
  const [newTask, setNewTask] = useState({
    room_number: '',
    task_type: 'Full Cleaning',
    priority: 'normal',
    assigned_to: '',
    notes: ''
  });
  
  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
    urgent: 0,
    totalRooms: 0,
    cleanRooms: 0,
    dirtyRooms: 0,
    checkouts: 0,
    occupancyRate: 0,
    avgCleaningTime: 0,
    todayCompletedTasks: 0,
    performance: 0
  });
  
  // Data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [isLoadingSupplies, setIsLoadingSupplies] = useState(false);
  const [requestPriority, setRequestPriority] = useState<'NORMAL' | 'URGENT' | 'LOW'>('NORMAL');
  
  // Housekeeping-related categories for filtering inventory
  const housekeepingCategories = ['cleaning', 'linen', 'toiletries', 'amenities', 'laundry', 'housekeeping', 'supplies'];

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    try {
      const [tasksRes, roomsRes, staffRes] = await Promise.all([
        housekeepingAPI.getTasks(),
        roomsAPI.getRooms(),
        isSupervisor ? housekeepingAPI.getStaffWorkload() : Promise.resolve({ data: [] })
      ]);

      const taskList = tasksRes.data || tasksRes.tasks || tasksRes || [];
      const roomList = roomsRes.data || roomsRes.rooms || roomsRes || [];
      const staffList = staffRes.data || staffRes.staff || staffRes || [];
      
      // Process housekeepers for supervisor view from API
      if (isSupervisor && Array.isArray(staffList) && staffList.length > 0) {
        const processedHousekeepers: Housekeeper[] = staffList.map((s: any) => ({
          id: s.id,
          name: s.staff_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Staff',
          status: s.total_tasks > 0 ? 'busy' : 'available',
          current_task: s.tasks?.[0]?.room?.room_number ? `Room ${s.tasks[0].room.room_number}` : undefined,
          tasks_completed: s.tasks?.filter((t: any) => t.status === 'completed').length || 0,
        }));
        setHousekeepers(processedHousekeepers);
      }
      
      const tasksArray = Array.isArray(taskList) ? taskList : [];
      const roomsArray = Array.isArray(roomList) ? roomList : [];

      // Process tasks
      const processedTasks: Task[] = tasksArray.map((t: any) => ({
        id: t.id || String(Math.random()),
        room_number: t.room_number || t.room?.room_number || '-',
        room_id: t.room_id,
        task_type: t.task_type || t.type || 'Cleaning',
        priority: t.priority || 'normal',
        status: t.status || 'pending',
        assigned_to: t.assigned_to || t.assignee?.name,
        started_at: t.started_at,
        completed_at: t.completed_at,
        notes: t.notes,
        created_at: t.created_at || new Date().toISOString()
      }));
      setTasks(processedTasks);

      // Process rooms
      const processedRooms: Room[] = roomsArray.map((r: any) => ({
        id: r.id,
        room_number: r.room_number || r.number,
        floor: r.floor || Math.ceil(parseInt(r.room_number || '100') / 100),
        type: r.room_type || r.type || 'Standard',
        status: mapRoomStatus(r.status),
        guest_name: r.current_guest?.name || r.guest_name,
        checkout_time: r.checkout_time,
        priority: r.cleaning_priority,
        assigned_to: r.assigned_housekeeper,
        notes: r.notes
      }));
      setRooms(processedRooms);

      // Calculate stats
      const pending = processedTasks.filter(t => t.status === 'pending').length;
      const inProgress = processedTasks.filter(t => t.status === 'in_progress' || t.status === 'in-progress').length;
      const completed = processedTasks.filter(t => t.status === 'completed').length;
      const urgent = processedTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
      
      const cleanRooms = processedRooms.filter(r => r.status === 'clean').length;
      const dirtyRooms = processedRooms.filter(r => r.status === 'dirty' || r.status === 'checkout').length;
      const checkouts = processedRooms.filter(r => r.status === 'checkout').length;
      const occupied = processedRooms.filter(r => r.status === 'occupied').length;

      setStats({
        pending,
        inProgress,
        completed,
        urgent,
        totalRooms: processedRooms.length,
        cleanRooms,
        dirtyRooms,
        checkouts,
        occupancyRate: processedRooms.length > 0 ? Math.round((occupied / processedRooms.length) * 100) : 0,
        avgCleaningTime: 0,
        todayCompletedTasks: completed,
        performance: 0
      });

    } catch (error) {
      console.error('Error fetching housekeeping data:', error);
      toast.error('Failed to load housekeeping data');
    } finally {
      setIsLoading(false);
    }
  };

  // Map room status from API to our types
  const mapRoomStatus = (status: string): RoomStatus => {
    const statusMap: Record<string, RoomStatus> = {
      'available': 'clean',
      'clean': 'clean',
      'dirty': 'dirty',
      'cleaning': 'cleaning',
      'inspecting': 'inspecting',
      'maintenance': 'maintenance',
      'occupied': 'occupied',
      'checkout': 'checkout',
      'checked_out': 'checkout'
    };
    return statusMap[status?.toLowerCase()] || 'dirty';
  };

  
  // Fetch supplies from inventory module (uses user's branch automatically)
  const fetchSupplies = async () => {
    setIsLoadingSupplies(true);
    try {
      // getBranchStock uses user's branch_id from token
      const response = await storeAPI.getBranchStock(user?.branch_id || undefined);
      const stockItems = response.data || response || [];
      
      // Transform inventory items to supplies format, filtering for housekeeping-related items
      const processedSupplies: Supply[] = stockItems
        .filter((item: any) => {
          const category = (item.item?.category || '').toLowerCase();
          const name = (item.item?.item_name || '').toLowerCase();
          // Include items that are housekeeping-related
          return housekeepingCategories.some(cat => category.includes(cat) || name.includes(cat)) ||
                 name.includes('towel') || name.includes('sheet') || name.includes('pillow') ||
                 name.includes('soap') || name.includes('shampoo') || name.includes('tissue') ||
                 name.includes('cleaner') || name.includes('detergent') || name.includes('freshener');
        })
        .map((item: any) => {
          const qty = item.quantity || 0;
          const reorderLevel = item.reorder_level || 10;
          let status: 'sufficient' | 'low' | 'critical' = 'sufficient';
          if (qty <= reorderLevel * 0.3) status = 'critical';
          else if (qty <= reorderLevel) status = 'low';
          
          return {
            id: item.id || item.item_sku,
            sku: item.item_sku,
            name: item.item?.item_name || item.item_sku,
            quantity: qty,
            min_level: reorderLevel,
            unit: item.item?.unit_of_measure || 'pcs',
            category: item.item?.category,
            status
          };
        });
      
      setSupplies(processedSupplies);
    } catch (error) {
      console.error('Error fetching supplies:', error);
      toast.error('Failed to load supplies from inventory');
    } finally {
      setIsLoadingSupplies(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchSupplies();
  }, []);

  // Task actions
  const startTask = async (task: Task) => {
    try {
      await housekeepingAPI.updateTask(task.id, { status: 'in_progress' }).catch(() => {});
      toast.success(`Started cleaning Room ${task.room_number}`);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'in_progress', started_at: new Date().toISOString() } : t));
      setStats(prev => ({ ...prev, pending: prev.pending - 1, inProgress: prev.inProgress + 1 }));
    } catch (error) {
      toast.error('Failed to start task');
    }
  };

  const completeTask = async (task: Task) => {
    try {
      await housekeepingAPI.completeTask(task.id).catch(() => {});
      toast.success(`Completed cleaning Room ${task.room_number}`);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t));
      setStats(prev => ({ ...prev, inProgress: Math.max(0, prev.inProgress - 1), completed: prev.completed + 1 }));
      // Update room status
      setRooms(prev => prev.map(r => r.room_number === task.room_number ? { ...r, status: 'clean' } : r));
    } catch (error) {
      toast.error('Failed to complete task');
    }
  };

  const updateRoomStatus = async (room: Room, newStatus: RoomStatus) => {
    try {
      toast.success(`Room ${room.room_number} marked as ${newStatus}`);
      setRooms(prev => prev.map(r => r.id === room.id ? { ...r, status: newStatus } : r));
    } catch (error) {
      toast.error('Failed to update room status');
    }
  };

  // Supervisor: Assign task to housekeeper
  const assignTask = async (task: Task, housekeeperId: string) => {
    const housekeeper = housekeepers.find(h => h.id === housekeeperId);
    if (!housekeeper) return;
    
    try {
      await housekeepingAPI.updateTask(task.id, { assigned_to: housekeeperId }).catch(() => {});
      toast.success(`Task assigned to ${housekeeper.name}`);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, assigned_to: housekeeper.name } : t));
      setIsAssignModalOpen(false);
      setSelectedTask(null);
      setSelectedHousekeeper('');
    } catch (error) {
      toast.error('Failed to assign task');
    }
  };

  // Supervisor: Create new task
  const createTask = async () => {
    if (!newTask.room_number) {
      toast.error('Please enter room number');
      return;
    }
    
    try {
      const taskData = {
        room_number: newTask.room_number,
        task_type: newTask.task_type,
        priority: newTask.priority,
        assigned_to: newTask.assigned_to,
        notes: newTask.notes,
        status: 'pending'
      };
      
      await housekeepingAPI.createTask(taskData).catch(() => {});
      
      const assignedName = housekeepers.find(h => h.id === newTask.assigned_to)?.name || 'Unassigned';
      const createdTask: Task = {
        id: String(Date.now()),
        room_number: newTask.room_number,
        task_type: newTask.task_type,
        priority: newTask.priority,
        status: 'pending',
        assigned_to: assignedName,
        created_at: new Date().toISOString()
      };
      
      setTasks(prev => [createdTask, ...prev]);
      setStats(prev => ({ ...prev, pending: prev.pending + 1 }));
      toast.success(`Task created for Room ${newTask.room_number}`);
      setIsCreateTaskModalOpen(false);
      setNewTask({ room_number: '', task_type: 'Full Cleaning', priority: 'normal', assigned_to: '', notes: '' });
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  // Submit supply request to inventory module
  const submitSupplyRequest = async () => {
    if (supplyRequests.length === 0) {
      toast.error('Please add items to request');
      return;
    }
    
    try {
      // Format items for stock request API
      const requestItems = supplyRequests.map(r => ({
        item_sku: r.item_sku,
        requested_quantity: r.quantity,
        current_branch_stock: r.current_stock || 0
      }));
      
      // Create stock request through inventory module (branch is auto-determined from user token)
      const response = await storeAPI.createStockRequest({
        items: requestItems.map(item => ({ item_sku: item.item_sku, quantity: item.requested_quantity })),
        notes: requestNotes || `Housekeeping supply request from ${user?.branch_name || 'branch'} - ${supplyRequests.length} items`,
        priority: requestPriority
      });
      
      toast.success(`Stock request ${response.data?.request_number || ''} submitted successfully!`);
      setIsRequestSupplyModalOpen(false);
      setSupplyRequests([]);
      setRequestNotes('');
      setRequestPriority('NORMAL');
      
      // Refresh supplies to show updated status
      fetchSupplies();
    } catch (error: any) {
      console.error('Error submitting supply request:', error);
      toast.error(error.message || 'Failed to submit supply request');
    }
  };

  // Add item to supply request
  const addToSupplyRequest = (supply: Supply) => {
    const existing = supplyRequests.find(r => r.item_sku === supply.sku);
    if (existing) {
      setSupplyRequests(prev => prev.map(r => 
        r.item_sku === supply.sku ? { ...r, quantity: r.quantity + 1 } : r
      ));
    } else {
      setSupplyRequests(prev => [...prev, { 
        item_sku: supply.sku, 
        item_name: supply.name, 
        quantity: 1,
        current_stock: supply.quantity
      }]);
    }
  };

  // Update supply request quantity
  const updateSupplyRequestQty = (itemSku: string, delta: number) => {
    setSupplyRequests(prev => prev.map(r => {
      if (r.item_sku === itemSku) {
        const newQty = Math.max(1, r.quantity + delta);
        return { ...r, quantity: newQty };
      }
      return r;
    }));
  };

  // Remove from supply request
  const removeFromSupplyRequest = (itemSku: string) => {
    setSupplyRequests(prev => prev.filter(r => r.item_sku !== itemSku));
  };

  // Status colors
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      clean: 'bg-emerald-500',
      dirty: 'bg-red-500',
      cleaning: 'bg-blue-500',
      inspecting: 'bg-purple-500',
      maintenance: 'bg-orange-500',
      occupied: 'bg-gray-500',
      checkout: 'bg-amber-500',
      pending: 'bg-amber-500',
      in_progress: 'bg-blue-500',
      'in-progress': 'bg-blue-500',
      completed: 'bg-emerald-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusBg = (status: string) => {
    const colors: Record<string, string> = {
      clean: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
      dirty: 'bg-red-50 border-red-200 hover:bg-red-100',
      cleaning: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      inspecting: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      maintenance: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
      occupied: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
      checkout: 'bg-amber-50 border-amber-200 hover:bg-amber-100'
    };
    return colors[status] || 'bg-gray-50 border-gray-200';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      normal: 'bg-blue-100 text-blue-800',
      low: 'bg-gray-100 text-gray-800'
    };
    return colors[priority] || colors.normal;
  };

  const getSupplyStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      sufficient: 'text-emerald-600 bg-emerald-100',
      low: 'text-amber-600 bg-amber-100',
      critical: 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = searchQuery === '' || 
      t.room_number.includes(searchQuery) ||
      t.task_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Filter rooms
  const filteredRooms = rooms.filter(r => {
    const matchesSearch = searchQuery === '' || 
      r.room_number.includes(searchQuery) ||
      r.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl shadow-lg"
              >
                <SprayCan className="h-8 w-8 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Housekeeping Dashboard</h1>
                <p className="text-gray-600">Welcome, {user?.firstName}! {stats.pending} tasks waiting.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search rooms or tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button onClick={fetchDashboardData} variant="outline" size="icon">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="p-4 bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 text-sm">Pending</p>
                    <p className="text-3xl font-bold">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-200" />
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="p-4 bg-gradient-to-br from-blue-500 to-indigo-500 text-white border-0 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">In Progress</p>
                    <p className="text-3xl font-bold">{stats.inProgress}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-blue-200" />
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="p-4 bg-gradient-to-br from-emerald-500 to-green-500 text-white border-0 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 text-sm">Completed</p>
                    <p className="text-3xl font-bold">{stats.completed}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-emerald-200" />
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="p-4 bg-gradient-to-br from-red-500 to-rose-500 text-white border-0 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm">Urgent</p>
                    <p className="text-3xl font-bold">{stats.urgent}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-200" />
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-4 bg-gradient-to-br from-teal-500 to-cyan-500 text-white border-0 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-teal-100 text-sm">Clean Rooms</p>
                    <p className="text-3xl font-bold">{stats.cleanRooms}</p>
                  </div>
                  <Bed className="h-8 w-8 text-teal-200" />
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card className="p-4 bg-gradient-to-br from-purple-500 to-violet-500 text-white border-0 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Checkouts</p>
                    <p className="text-3xl font-bold">{stats.checkouts}</p>
                  </div>
                  <Key className="h-8 w-8 text-purple-200" />
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: Home },
              { id: 'rooms', label: 'Room Status', icon: Bed },
              { id: 'tasks', label: isSupervisor ? 'All Tasks' : 'My Tasks', icon: ClipboardList },
              { id: 'supplies', label: 'Supplies', icon: Package },
              ...(isSupervisor ? [{ id: 'team', label: 'Team', icon: Users }] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Urgent Tasks */}
              <Card className="lg:col-span-2 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Priority Tasks
                  </h2>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('tasks')}>
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {tasks.filter(t => t.status !== 'completed').slice(0, 5).map((task, idx) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(task.priority)}`} />
                        <div>
                          <p className="font-medium">Room {task.room_number}</p>
                          <p className="text-sm text-gray-500">{task.task_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                        {task.status === 'pending' && (
                          <Button size="sm" onClick={() => startTask(task)}>
                            <Play className="h-3 w-3 mr-1" /> Start
                          </Button>
                        )}
                        {task.status === 'in_progress' && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => completeTask(task)}>
                            <Check className="h-3 w-3 mr-1" /> Done
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {tasks.filter(t => t.status !== 'completed').length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-300" />
                      <p>All tasks completed! Great job!</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Quick Actions & Performance */}
              <div className="space-y-6">
                <Card className="p-5">
                  <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {isSupervisor && (
                      <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setIsCreateTaskModalOpen(true)}>
                        <Plus className="h-6 w-6 mb-2 text-teal-600" />
                        <span className="text-sm">Create Task</span>
                      </Button>
                    )}
                    <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setIsReportModalOpen(true)}>
                      <AlertCircle className="h-6 w-6 mb-2 text-amber-600" />
                      <span className="text-sm">Report Issue</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setIsRequestSupplyModalOpen(true)}>
                      <ShoppingCart className="h-6 w-6 mb-2 text-blue-600" />
                      <span className="text-sm">Request Supplies</span>
                    </Button>
                    <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setActiveTab('rooms')}>
                      <Bed className="h-6 w-6 mb-2 text-teal-600" />
                      <span className="text-sm">Room Status</span>
                    </Button>
                    {isSupervisor && (
                      <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setActiveTab('team')}>
                        <Users className="h-6 w-6 mb-2 text-purple-600" />
                        <span className="text-sm">Manage Team</span>
                      </Button>
                    )}
                  </div>
                </Card>

                <Card className="p-5 bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200">
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Award className="h-5 w-5 text-teal-600" />
                    Today's Performance
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Tasks Completed</span>
                      <span className="font-bold text-teal-700">{stats.todayCompletedTasks}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Avg. Cleaning Time</span>
                      <span className="font-bold text-teal-700">{stats.avgCleaningTime} min</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Efficiency Score</span>
                      <span className="font-bold text-emerald-600">{stats.performance}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${stats.performance}%` }}
                      />
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Rooms Tab */}
          {activeTab === 'rooms' && (
            <div className="space-y-6">
              {/* Room Status Legend */}
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm font-medium text-gray-500">Status:</span>
                  {[
                    { status: 'clean', label: 'Clean', count: rooms.filter(r => r.status === 'clean').length },
                    { status: 'dirty', label: 'Dirty', count: rooms.filter(r => r.status === 'dirty').length },
                    { status: 'cleaning', label: 'Cleaning', count: rooms.filter(r => r.status === 'cleaning').length },
                    { status: 'checkout', label: 'Checkout', count: rooms.filter(r => r.status === 'checkout').length },
                    { status: 'occupied', label: 'Occupied', count: rooms.filter(r => r.status === 'occupied').length },
                    { status: 'maintenance', label: 'Maintenance', count: rooms.filter(r => r.status === 'maintenance').length }
                  ].map(item => (
                    <button
                      key={item.status}
                      onClick={() => setFilterStatus(filterStatus === item.status ? 'all' : item.status)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition ${
                        filterStatus === item.status ? 'bg-gray-200' : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`} />
                      <span className="text-sm">{item.label}</span>
                      <Badge variant="outline" className="text-xs">{item.count}</Badge>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Room Grid by Floor */}
              {floors.map(floor => (
                <Card key={floor} className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Home className="h-5 w-5 text-gray-500" />
                    Floor {floor}
                  </h3>
                  <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
                    {filteredRooms
                      .filter(r => r.floor === floor)
                      .map(room => (
                        <motion.div
                          key={room.id}
                          whileHover={{ scale: 1.05 }}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${getStatusBg(room.status)}`}
                          onClick={() => {
                            if (room.status === 'dirty' || room.status === 'checkout') {
                              updateRoomStatus(room, 'cleaning');
                            } else if (room.status === 'cleaning') {
                              updateRoomStatus(room, 'clean');
                            }
                          }}
                        >
                          <div className="text-center">
                            <p className="font-bold">{room.room_number}</p>
                            <p className="text-xs text-gray-500 capitalize">{room.status}</p>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{isSupervisor ? 'All Tasks' : 'My Tasks'}</h2>
                <div className="flex gap-2">
                  {isSupervisor && (
                    <Button size="sm" onClick={() => setIsCreateTaskModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Create Task
                    </Button>
                  )}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-sm border rounded-lg px-3 py-1.5"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                      {isSupervisor && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredTasks.map(task => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium">Room {task.room_number}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{task.task_type}</td>
                        {isSupervisor && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">{task.assigned_to || 'Unassigned'}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${getStatusColor(task.status)} text-white`}>
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {isSupervisor && task.status === 'pending' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setIsAssignModalOpen(true);
                                }}
                              >
                                <UserPlus className="h-3 w-3 mr-1" /> Assign
                              </Button>
                            )}
                            {task.status === 'pending' && !isSupervisor && (
                              <Button size="sm" onClick={() => startTask(task)}>
                                <Play className="h-3 w-3 mr-1" /> Start
                              </Button>
                            )}
                            {(task.status === 'in_progress' || task.status === 'in-progress') && (
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => completeTask(task)}>
                                <Check className="h-3 w-3 mr-1" /> Complete
                              </Button>
                            )}
                            {task.status === 'completed' && (
                              <Badge className="bg-emerald-100 text-emerald-800">
                                <Check className="h-3 w-3 mr-1" /> Done
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Supplies Tab */}
          {activeTab === 'supplies' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Supply Inventory</h2>
                    {user?.branch_name && (
                      <p className="text-sm text-gray-500">Branch: {user.branch_name}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={fetchSupplies} disabled={isLoadingSupplies}>
                      <RefreshCw className={`h-4 w-4 ${isLoadingSupplies ? 'animate-spin' : ''}`} />
                    </Button>
                    <Link href="/dashboard/storekeeping/requests">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" /> View Requests
                      </Button>
                    </Link>
                    <Button size="sm" onClick={() => setIsRequestSupplyModalOpen(true)}>
                      <ShoppingCart className="h-4 w-4 mr-1" /> Request Supplies
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {isLoadingSupplies ? (
                    <div className="text-center py-8 text-gray-400">Loading inventory...</div>
                  ) : supplies.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      No housekeeping supplies found in inventory.
                      <br />
                      <span className="text-sm">Items will appear here when tagged with housekeeping categories.</span>
                    </div>
                  ) : supplies.map(supply => (
                    <div key={supply.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium">{supply.name}</p>
                          <p className="text-sm text-gray-500">{supply.quantity} {supply.unit} available</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              supply.status === 'sufficient' ? 'bg-emerald-500' :
                              supply.status === 'low' ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min((supply.quantity / (supply.min_level * 2)) * 100, 100)}%` }}
                          />
                        </div>
                        <Badge className={getSupplyStatusColor(supply.status)}>
                          {supply.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="text-lg font-semibold mb-4">Supply Summary</h2>
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-700">Sufficient</span>
                      <span className="font-bold text-emerald-700">
                        {supplies.filter(s => s.status === 'sufficient').length}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-700">Low Stock</span>
                      <span className="font-bold text-amber-700">
                        {supplies.filter(s => s.status === 'low').length}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between">
                      <span className="text-red-700">Critical</span>
                      <span className="font-bold text-red-700">
                        {supplies.filter(s => s.status === 'critical').length}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Team Tab (Supervisor Only) */}
          {activeTab === 'team' && isSupervisor && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Housekeeping Team</h2>
                  <Badge className="bg-teal-100 text-teal-800">
                    {housekeepers.filter(h => h.status === 'available').length} Available
                  </Badge>
                </div>
                <div className="space-y-3">
                  {housekeepers.map(hk => (
                    <div key={hk.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-semibold">
                          {hk.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-medium">{hk.name}</p>
                          <p className="text-sm text-gray-500">
                            {hk.current_task ? `Working on ${hk.current_task}` : 'No active task'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Today's Tasks</p>
                          <p className="font-bold text-teal-600">{hk.tasks_completed}</p>
                        </div>
                        <Badge className={
                          hk.status === 'available' ? 'bg-emerald-100 text-emerald-800' :
                          hk.status === 'busy' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {hk.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="p-5">
                  <h2 className="text-lg font-semibold mb-4">Team Summary</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-emerald-600" />
                        <span className="text-gray-700">Available</span>
                      </div>
                      <span className="font-bold text-emerald-600">
                        {housekeepers.filter(h => h.status === 'available').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                        <span className="text-gray-700">Busy</span>
                      </div>
                      <span className="font-bold text-blue-600">
                        {housekeepers.filter(h => h.status === 'busy').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Moon className="h-5 w-5 text-gray-600" />
                        <span className="text-gray-700">Off Duty</span>
                      </div>
                      <span className="font-bold text-gray-600">
                        {housekeepers.filter(h => h.status === 'off-duty').length}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card className="p-5 bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-200">
                  <h2 className="text-lg font-semibold mb-3">Team Performance</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Completed Today</span>
                      <span className="font-bold text-teal-700">
                        {housekeepers.reduce((sum, h) => sum + h.tasks_completed, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg per Person</span>
                      <span className="font-bold text-teal-700">
                        {(housekeepers.reduce((sum, h) => sum + h.tasks_completed, 0) / housekeepers.length).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* Report Issue Modal */}
        <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report Maintenance Issue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">Room Number</label>
                <Input placeholder="Enter room number" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Issue Type</label>
                <select className="w-full p-2 border rounded-lg">
                  <option>Plumbing</option>
                  <option>Electrical</option>
                  <option>HVAC</option>
                  <option>Furniture</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="w-full p-2 border rounded-lg" rows={3} placeholder="Describe the issue..." />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsReportModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  onClick={() => {
                    toast.success('Issue reported to maintenance');
                    setIsReportModalOpen(false);
                  }}
                >
                  Submit Report
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign Task Modal (Supervisor) */}
        <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {selectedTask && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">Room {selectedTask.room_number}</p>
                  <p className="text-sm text-gray-500">{selectedTask.task_type}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Select Housekeeper</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {housekeepers.filter(h => h.status !== 'off-duty').map(hk => (
                    <div
                      key={hk.id}
                      onClick={() => setSelectedHousekeeper(hk.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        selectedHousekeeper === hk.id 
                          ? 'border-teal-500 bg-teal-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-sm font-medium">
                            {hk.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium">{hk.name}</span>
                        </div>
                        <Badge className={
                          hk.status === 'available' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }>
                          {hk.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setIsAssignModalOpen(false); setSelectedTask(null); }} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  disabled={!selectedHousekeeper}
                  onClick={() => selectedTask && assignTask(selectedTask, selectedHousekeeper)}
                >
                  <UserCheck className="h-4 w-4 mr-2" /> Assign Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Task Modal (Supervisor) */}
        <Dialog open={isCreateTaskModalOpen} onOpenChange={setIsCreateTaskModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Room Number *</label>
                  <Input 
                    placeholder="e.g. 105" 
                    value={newTask.room_number}
                    onChange={(e) => setNewTask(prev => ({ ...prev, room_number: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Task Type</label>
                  <select 
                    className="w-full p-2 border rounded-lg"
                    value={newTask.task_type}
                    onChange={(e) => setNewTask(prev => ({ ...prev, task_type: e.target.value }))}
                  >
                    <option>Full Cleaning</option>
                    <option>Turndown Service</option>
                    <option>Deep Clean</option>
                    <option>Linen Change</option>
                    <option>Bathroom Clean</option>
                    <option>Guest Request</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <select 
                    className="w-full p-2 border rounded-lg"
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Assign To</label>
                  <select 
                    className="w-full p-2 border rounded-lg"
                    value={newTask.assigned_to}
                    onChange={(e) => setNewTask(prev => ({ ...prev, assigned_to: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {housekeepers.filter(h => h.status !== 'off-duty').map(hk => (
                      <option key={hk.id} value={hk.id}>{hk.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea 
                  className="w-full p-2 border rounded-lg" 
                  rows={2} 
                  placeholder="Any special instructions..."
                  value={newTask.notes}
                  onChange={(e) => setNewTask(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsCreateTaskModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700" onClick={createTask}>
                  <Plus className="h-4 w-4 mr-2" /> Create Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Request Supplies Modal */}
        <Dialog open={isRequestSupplyModalOpen} onOpenChange={setIsRequestSupplyModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Request Supplies from Central Warehouse</DialogTitle>
              {user?.branch_name && (
                <p className="text-sm text-gray-500">Requesting for: {user.branch_name}</p>
              )}
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Priority Selection */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Priority:</label>
                <div className="flex gap-2">
                  {['LOW', 'NORMAL', 'URGENT'].map(p => (
                    <Button
                      key={p}
                      size="sm"
                      variant={requestPriority === p ? 'default' : 'outline'}
                      className={requestPriority === p ? (
                        p === 'URGENT' ? 'bg-red-600 hover:bg-red-700' :
                        p === 'LOW' ? 'bg-gray-600 hover:bg-gray-700' : 'bg-teal-600 hover:bg-teal-700'
                      ) : ''}
                      onClick={() => setRequestPriority(p as any)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Available Supplies */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Available Supplies {isLoadingSupplies && '(Loading...)'}</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                    {supplies.length === 0 ? (
                      <p className="text-center py-8 text-gray-400 text-sm">
                        {isLoadingSupplies ? 'Loading supplies...' : 'No housekeeping supplies found in inventory'}
                      </p>
                    ) : supplies.map(supply => (
                      <div 
                        key={supply.id} 
                        className={`flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 cursor-pointer ${
                          supply.status === 'critical' ? 'bg-red-50 border border-red-200' :
                          supply.status === 'low' ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                        }`}
                        onClick={() => addToSupplyRequest(supply)}
                      >
                        <div>
                          <p className="text-sm font-medium">{supply.name}</p>
                          <p className="text-xs text-gray-500">
                            {supply.quantity} {supply.unit} in stock
                            {supply.status !== 'sufficient' && (
                              <span className={`ml-2 ${supply.status === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                                ({supply.status})
                              </span>
                            )}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Request Cart */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Your Request ({supplyRequests.length} items)</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                    {supplyRequests.length === 0 ? (
                      <p className="text-center py-8 text-gray-400 text-sm">
                        Click items to add to request
                      </p>
                    ) : (
                      supplyRequests.map(item => (
                        <div key={item.item_sku} className="flex items-center justify-between p-2 bg-teal-50 rounded-lg">
                          <div>
                            <span className="text-sm font-medium">{item.item_name}</span>
                            <p className="text-xs text-gray-500">SKU: {item.item_sku}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-6 w-6 p-0"
                              onClick={() => updateSupplyRequestQty(item.item_sku, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-6 w-6 p-0"
                              onClick={() => updateSupplyRequestQty(item.item_sku, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={() => removeFromSupplyRequest(item.item_sku)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
                <textarea 
                  className="w-full p-2 border rounded-lg" 
                  rows={2} 
                  placeholder="Any special requirements or reason for request..."
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setIsRequestSupplyModalOpen(false); setSupplyRequests([]); setRequestPriority('NORMAL'); }} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-teal-600 hover:bg-teal-700" 
                  disabled={supplyRequests.length === 0}
                  onClick={submitSupplyRequest}
                >
                  <Send className="h-4 w-4 mr-2" /> Submit Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
