'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, Bed, CheckCircle, Clock, AlertTriangle,
  TrendingUp, Star, Settings, Plus, RefreshCw, ChevronRight,
  Sparkles, Package, ClipboardCheck, UserCog, BarChart3,
  Timer, Award, Target, Wrench, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { storeAPI, housekeepingAPI } from '@/lib/api';

interface BranchHousekeeping {
  id: number;
  name: string;
  code: string;
  totalRooms: number;
  cleanRooms: number;
  dirtyRooms: number;
  inProgress: number;
  staffOnDuty: number;
  avgCleanTime: number;
  inspectionScore: number;
}

interface HousekeepingStaff {
  id: string;
  name: string;
  branch: string;
  status: 'on_duty' | 'off_duty' | 'on_leave';
  tasksToday: number;
  avgRating: number;
  efficiency: number;
}

interface TaskType {
  id: string;
  name: string;
  standardTime: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  description: string;
}

export default function AdminHousekeepingPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'settings'>('overview');
  
  // Stats
  const [globalStats, setGlobalStats] = useState({
    totalRooms: 0,
    totalClean: 0,
    totalDirty: 0,
    totalInProgress: 0,
    totalStaff: 0,
    staffOnDuty: 0,
    avgCleanTime: 0,
    avgInspectionScore: 0,
    tasksCompletedToday: 0,
    pendingInspections: 0
  });

  // Branch data
  const [branchData, setBranchData] = useState<BranchHousekeeping[]>([]);
  
  // Staff data
  const [staffList, setStaffList] = useState<HousekeepingStaff[]>([]);
  
  // Task types
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([
    { id: '1', name: 'Full Cleaning', standardTime: 45, priority: 'normal', description: 'Complete room cleaning including bed making, bathroom, vacuuming' },
    { id: '2', name: 'Checkout Clean', standardTime: 60, priority: 'high', description: 'Deep clean after guest checkout' },
    { id: '3', name: 'Turndown Service', standardTime: 15, priority: 'low', description: 'Evening turndown service' },
    { id: '4', name: 'Deep Clean', standardTime: 90, priority: 'urgent', description: 'Deep cleaning including carpet shampooing' },
    { id: '5', name: 'Touch Up', standardTime: 20, priority: 'low', description: 'Quick touch up for stay-over guests' },
  ]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch branches
      const branchesRes = await storeAPI.getBranches().catch(() => ({ branches: [] }));
      const branches = branchesRes.branches || branchesRes.data || [];
      
      // Fetch housekeeping tasks
      const tasksRes = await housekeepingAPI.getTasks().catch(() => ({ tasks: [] }));
      const tasks = tasksRes.tasks || tasksRes.data || tasksRes || [];

      // Process branch housekeeping data
      const processedBranches: BranchHousekeeping[] = branches
        .filter((b: any) => !b.is_central_warehouse)
        .map((branch: any) => ({
          id: branch.id,
          name: branch.name,
          code: branch.code,
          totalRooms: Math.floor(Math.random() * 30) + 20, // Will be from real data
          cleanRooms: Math.floor(Math.random() * 20) + 10,
          dirtyRooms: Math.floor(Math.random() * 10) + 2,
          inProgress: Math.floor(Math.random() * 5) + 1,
          staffOnDuty: Math.floor(Math.random() * 5) + 2,
          avgCleanTime: Math.floor(Math.random() * 20) + 25,
          inspectionScore: Math.floor(Math.random() * 15) + 85
        }));

      setBranchData(processedBranches);

      // Calculate global stats
      const totals = processedBranches.reduce((acc, b) => ({
        totalRooms: acc.totalRooms + b.totalRooms,
        totalClean: acc.totalClean + b.cleanRooms,
        totalDirty: acc.totalDirty + b.dirtyRooms,
        totalInProgress: acc.totalInProgress + b.inProgress,
        staffOnDuty: acc.staffOnDuty + b.staffOnDuty
      }), { totalRooms: 0, totalClean: 0, totalDirty: 0, totalInProgress: 0, staffOnDuty: 0 });

      setGlobalStats({
        ...totals,
        totalStaff: totals.staffOnDuty + Math.floor(Math.random() * 10),
        avgCleanTime: Math.round(processedBranches.reduce((sum, b) => sum + b.avgCleanTime, 0) / (processedBranches.length || 1)),
        avgInspectionScore: Math.round(processedBranches.reduce((sum, b) => sum + b.inspectionScore, 0) / (processedBranches.length || 1)),
        tasksCompletedToday: Array.isArray(tasks) ? tasks.filter((t: any) => t.status === 'completed').length : 0,
        pendingInspections: Math.floor(Math.random() * 8) + 2
      });

      // TODO: Replace with real staff API when available
      setStaffList([
        { id: '1', name: 'Mary Wanjiku', branch: 'FGB-KER', status: 'on_duty', tasksToday: 8, avgRating: 4.8, efficiency: 95 },
        { id: '2', name: 'Grace Akinyi', branch: 'FGB-KER', status: 'on_duty', tasksToday: 6, avgRating: 4.6, efficiency: 88 },
        { id: '3', name: 'Peter Mwangi', branch: 'FGB-BMT', status: 'on_duty', tasksToday: 7, avgRating: 4.5, efficiency: 92 },
        { id: '4', name: 'Jane Kemunto', branch: 'FGB-BMT', status: 'off_duty', tasksToday: 0, avgRating: 4.7, efficiency: 90 },
        { id: '5', name: 'John Omondi', branch: 'FGB-KAP', status: 'on_duty', tasksToday: 5, avgRating: 4.4, efficiency: 85 },
        { id: '6', name: 'Sarah Chebet', branch: 'FGB-LIT', status: 'on_duty', tasksToday: 6, avgRating: 4.9, efficiency: 98 },
        { id: '7', name: 'David Kibet', branch: 'FGB-MOG', status: 'on_leave', tasksToday: 0, avgRating: 4.3, efficiency: 82 },
      ]);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load housekeeping data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (clean: number, total: number) => {
    const ratio = clean / total;
    if (ratio >= 0.8) return 'text-green-600 bg-green-50';
    if (ratio >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Housekeeping Administration</h1>
              <p className="text-gray-600 mt-1">Manage housekeeping operations across all branches</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link href="/dashboard/housekeeping">
                <Button>
                  <Eye className="h-4 w-4 mr-2" />
                  Live Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-8">
              {[
                { id: 'overview', label: 'Branch Overview', icon: Building2 },
                { id: 'staff', label: 'Staff Management', icon: Users },
                { id: 'settings', label: 'Settings & Standards', icon: Settings }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Global Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4 bg-gradient-to-br from-teal-500 to-teal-600 text-white">
              <Bed className="h-8 w-8 mb-2 opacity-80" />
              <p className="text-3xl font-bold">{globalStats.totalRooms}</p>
              <p className="text-sm opacity-80">Total Rooms</p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CheckCircle className="h-8 w-8 mb-2 opacity-80" />
              <p className="text-3xl font-bold">{globalStats.totalClean}</p>
              <p className="text-sm opacity-80">Clean Rooms</p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-amber-500 to-amber-600 text-white">
              <Clock className="h-8 w-8 mb-2 opacity-80" />
              <p className="text-3xl font-bold">{globalStats.totalInProgress}</p>
              <p className="text-sm opacity-80">In Progress</p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <Users className="h-8 w-8 mb-2 opacity-80" />
              <p className="text-3xl font-bold">{globalStats.staffOnDuty}/{globalStats.totalStaff}</p>
              <p className="text-sm opacity-80">Staff On Duty</p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <Star className="h-8 w-8 mb-2 opacity-80" />
              <p className="text-3xl font-bold">{globalStats.avgInspectionScore}%</p>
              <p className="text-sm opacity-80">Avg Quality Score</p>
            </Card>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Branch Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {branchData.map(branch => (
                  <Card key={branch.id} className="p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{branch.name}</h3>
                        <p className="text-sm text-gray-500">{branch.code}</p>
                      </div>
                      <Badge className={getStatusColor(branch.cleanRooms, branch.totalRooms)}>
                        {Math.round((branch.cleanRooms / branch.totalRooms) * 100)}% Clean
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-2 bg-green-50 rounded-lg">
                        <p className="text-xl font-bold text-green-700">{branch.cleanRooms}</p>
                        <p className="text-xs text-green-600">Clean</p>
                      </div>
                      <div className="text-center p-2 bg-amber-50 rounded-lg">
                        <p className="text-xl font-bold text-amber-700">{branch.inProgress}</p>
                        <p className="text-xs text-amber-600">In Progress</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded-lg">
                        <p className="text-xl font-bold text-red-700">{branch.dirtyRooms}</p>
                        <p className="text-xs text-red-600">Pending</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {branch.staffOnDuty} staff on duty
                      </span>
                      <span className="flex items-center gap-1">
                        <Timer className="h-4 w-4" />
                        {branch.avgCleanTime} min avg
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">{branch.inspectionScore}% quality</span>
                      </div>
                      <Link href={`/dashboard/housekeeping?branch=${branch.id}`}>
                        <Button size="sm" variant="outline">
                          View Details <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-teal-600" />
                    Today's Performance
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Tasks Completed</span>
                      <span className="font-bold text-green-600">{globalStats.tasksCompletedToday}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Pending Inspections</span>
                      <span className="font-bold text-amber-600">{globalStats.pendingInspections}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Average Clean Time</span>
                      <span className="font-bold">{globalStats.avgCleanTime} min</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Quality Score</span>
                      <span className="font-bold text-teal-600">{globalStats.avgInspectionScore}%</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Alerts & Issues
                  </h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-800">Low Staff at FGB-MOG</p>
                      <p className="text-xs text-red-600">Only 1 housekeeper on duty</p>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-medium text-amber-800">Supply Alert - FGB-KER</p>
                      <p className="text-xs text-amber-600">Towels running low (15 remaining)</p>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-800">VIP Checkout - Room 305</p>
                      <p className="text-xs text-blue-600">Priority deep clean required</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Staff Tab */}
          {activeTab === 'staff' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Housekeeping Staff</h2>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Staff Member
                </Button>
              </div>

              <Card className="overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tasks Today</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Efficiency</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {staffList.map(staff => (
                      <tr key={staff.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center">
                              <span className="text-teal-700 font-medium">
                                {staff.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <span className="font-medium">{staff.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">{staff.branch}</td>
                        <td className="px-6 py-4">
                          <Badge className={
                            staff.status === 'on_duty' ? 'bg-green-100 text-green-800' :
                            staff.status === 'off_duty' ? 'bg-gray-100 text-gray-800' :
                            'bg-amber-100 text-amber-800'
                          }>
                            {staff.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm">{staff.tasksToday}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            <span className="text-sm font-medium">{staff.avgRating}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  staff.efficiency >= 90 ? 'bg-green-500' :
                                  staff.efficiency >= 70 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${staff.efficiency}%` }}
                              />
                            </div>
                            <span className="text-sm">{staff.efficiency}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Button size="sm" variant="outline">
                            <UserCog className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Task Types */}
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-teal-600" />
                      Task Types & Standards
                    </h3>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add Task Type
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {taskTypes.map(task => (
                      <div key={task.id} className="p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{task.name}</span>
                          <Badge className={
                            task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                            task.priority === 'high' ? 'bg-amber-100 text-amber-800' :
                            task.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {task.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">
                            <Timer className="h-4 w-4 inline mr-1" />
                            Standard: {task.standardTime} min
                          </span>
                          <Button size="sm" variant="ghost">Edit</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Inspection Criteria */}
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Target className="h-5 w-5 text-teal-600" />
                      Inspection Criteria
                    </h3>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Add Criteria
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: 'Bed Making', weight: 20, description: 'Sheets, pillows, bedspread properly arranged' },
                      { name: 'Bathroom Cleanliness', weight: 25, description: 'Toilet, sink, shower, mirrors, towels' },
                      { name: 'Floor & Carpet', weight: 15, description: 'Vacuumed, mopped, no stains' },
                      { name: 'Dusting & Surfaces', weight: 15, description: 'All surfaces dust-free' },
                      { name: 'Amenities', weight: 10, description: 'All amenities stocked and arranged' },
                      { name: 'Odor & Freshness', weight: 15, description: 'Room smells fresh, no odors' },
                    ].map((criteria, i) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{criteria.name}</span>
                          <span className="text-sm font-bold text-teal-600">{criteria.weight}%</span>
                        </div>
                        <p className="text-sm text-gray-600">{criteria.description}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Supply Categories */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5 text-teal-600" />
                    Supply Categories for Housekeeping
                  </h3>
                  <Link href="/dashboard/storekeeping/inventory">
                    <Button size="sm" variant="outline">
                      Manage Inventory <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { name: 'Linens', items: 'Sheets, Pillowcases, Towels', icon: Sparkles },
                    { name: 'Toiletries', items: 'Soap, Shampoo, Tissue', icon: Package },
                    { name: 'Cleaning', items: 'Detergent, Disinfectant', icon: Sparkles },
                    { name: 'Amenities', items: 'Slippers, Robes, Extras', icon: Award },
                  ].map((cat, i) => (
                    <div key={i} className="p-4 border rounded-lg text-center hover:bg-gray-50">
                      <cat.icon className="h-8 w-8 text-teal-600 mx-auto mb-2" />
                      <p className="font-medium">{cat.name}</p>
                      <p className="text-xs text-gray-500">{cat.items}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
