'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Users, ArrowLeft, RefreshCw, Plus, Search, User, Star, Clock,
  CheckCircle, Activity, Award, TrendingUp, Building, Phone, Mail,
  MapPin, Edit, Eye, BarChart3
} from 'lucide-react';
import { housekeepingAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

interface StaffMember {
  id: string;
  user_id: string;
  staff_code: string;
  designation: string;
  assigned_floors: number[];
  assigned_sections: string[];
  max_rooms_per_shift: number;
  max_credits_per_shift: number;
  skills: string[];
  languages: string[];
  avg_cleaning_time_minutes?: number;
  quality_score?: number;
  tasks_completed_today: number;
  tasks_completed_month: number;
  is_available: boolean;
  current_room_number?: string;
  user: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    status: string;
  };
}

interface WorkloadSummary {
  id: string;
  staff_name: string;
  staff_code: string;
  is_available: boolean;
  current_room_number?: string;
  active_tasks: number;
  completed_today: number;
  current_credits: number;
  max_credits_per_shift: number;
  quality_score?: number;
}

interface StaffPerformance {
  period: number;
  metrics: any[];
  summary: {
    totalTasks: number;
    avgCleaningTime: number;
    avgQualityScore: number;
    totalCredits: number;
    punctualityRate: number;
  };
}

const DESIGNATIONS = [
  'Room Attendant',
  'Senior Room Attendant',
  'Floor Supervisor',
  'Linen Attendant',
  'Public Area Attendant',
  'Executive Housekeeper'
];

const SKILLS = [
  'Deep Cleaning',
  'VIP Service',
  'Turndown Service',
  'Laundry',
  'Inventory Management',
  'Quality Inspection',
  'Training'
];

export default function StaffPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'workload' | 'performance'>('overview');
  
  // Data
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [workload, setWorkload] = useState<WorkloadSummary[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDesignation, setFilterDesignation] = useState<string>('all');
  const [filterAvailability, setFilterAvailability] = useState<string>('all');

  // Modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isManager = user?.role === UserRole.SUPER_ADMIN || 
                    user?.role === UserRole.GENERAL_MANAGER ||
                    user?.role === UserRole.BRANCH_MANAGER;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [staffRes, workloadRes] = await Promise.all([
        housekeepingAPI.getStaff().catch(() => ({ data: [] })),
        housekeepingAPI.getStaffWorkload().catch(() => ({ data: [] }))
      ]);

      setStaff(staffRes.data || []);
      setWorkload(workloadRes.data || []);
    } catch (error) {
      console.error('Error fetching staff data:', error);
      toast.error('Failed to load staff data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const viewStaffDetails = async (member: StaffMember) => {
    setSelectedStaff(member);
    setIsDetailModalOpen(true);
  };

  const viewPerformance = async (member: StaffMember) => {
    setSelectedStaff(member);
    try {
      const res = await housekeepingAPI.getStaffPerformance(member.id, 7);
      setStaffPerformance(res.data);
      setIsPerformanceModalOpen(true);
    } catch (error) {
      toast.error('Failed to load performance data');
    }
  };

  const filteredStaff = staff.filter(s => {
    const matchesSearch = searchQuery === '' ||
      s.staff_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.user.last_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDesignation = filterDesignation === 'all' || s.designation === filterDesignation;
    const matchesAvailability = filterAvailability === 'all' ||
      (filterAvailability === 'available' && s.is_available) ||
      (filterAvailability === 'busy' && !s.is_available);
    return matchesSearch && matchesDesignation && matchesAvailability;
  });

  const getAvailabilityBadge = (available: boolean) => (
    <Badge className={available ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
      {available ? 'Available' : 'Busy'}
    </Badge>
  );

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-gray-400';
    if (score >= 4.5) return 'text-emerald-600';
    if (score >= 3.5) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HOUSEKEEPING]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/housekeeping">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
                <p className="text-gray-600">Manage housekeeping team</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={fetchData} variant="outline" size="icon">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {isManager && (
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Staff
                </Button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <Users className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Staff</p>
                  <p className="text-2xl font-bold">{staff.length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Available</p>
                  <p className="text-2xl font-bold">{staff.filter(s => s.is_available).length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Activity className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">On Task</p>
                  <p className="text-2xl font-bold">{staff.filter(s => !s.is_available).length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Star className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg Quality</p>
                  <p className="text-2xl font-bold">
                    {staff.length > 0 
                      ? (staff.filter(s => s.quality_score).reduce((sum, s) => sum + (s.quality_score || 0), 0) / staff.filter(s => s.quality_score).length).toFixed(1)
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            {[
              { id: 'overview', label: 'All Staff', icon: Users },
              { id: 'workload', label: 'Current Workload', icon: Activity },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-violet-500 text-violet-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Staff Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={filterDesignation}
                  onChange={(e) => setFilterDesignation(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="all">All Designations</option>
                  {DESIGNATIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  value={filterAvailability}
                  onChange={(e) => setFilterAvailability(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                </select>
              </div>

              {/* Staff Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStaff.map(member => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {member.user.first_name[0]}{member.user.last_name[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.user.first_name} {member.user.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{member.staff_code}</p>
                          </div>
                        </div>
                        {getAvailabilityBadge(member.is_available)}
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Award className="h-4 w-4" />
                          <span>{member.designation}</span>
                        </div>
                        {member.assigned_floors.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Building className="h-4 w-4" />
                            <span>Floors: {member.assigned_floors.join(', ')}</span>
                          </div>
                        )}
                        {member.current_room_number && (
                          <div className="flex items-center gap-2 text-sm text-amber-600">
                            <MapPin className="h-4 w-4" />
                            <span>Currently in Room {member.current_room_number}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-gray-400" />
                            <span>{member.tasks_completed_today} today</span>
                          </div>
                          {member.quality_score && (
                            <div className="flex items-center gap-1">
                              <Star className={`h-4 w-4 ${getScoreColor(member.quality_score)}`} />
                              <span className={getScoreColor(member.quality_score)}>
                                {member.quality_score.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewStaffDetails(member)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewPerformance(member)}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {/* Workload Tab */}
          {activeTab === 'workload' && (
            <Card className="p-5">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Staff</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Current Room</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Active Tasks</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Completed Today</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Credits</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Capacity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workload.map(w => {
                      const capacityPercent = (w.current_credits / w.max_credits_per_shift) * 100;
                      return (
                        <tr key={w.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{w.staff_name}</p>
                              <p className="text-sm text-gray-500">{w.staff_code}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {getAvailabilityBadge(w.is_available)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {w.current_room_number || '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-medium">{w.active_tasks}</td>
                          <td className="py-3 px-4 text-center">{w.completed_today}</td>
                          <td className="py-3 px-4 text-center">{w.current_credits} / {w.max_credits_per_shift}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    capacityPercent >= 90 ? 'bg-red-500' :
                                    capacityPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-500 w-12">
                                {Math.round(capacityPercent)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Staff Detail Modal */}
          <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Staff Details</DialogTitle>
              </DialogHeader>

              {selectedStaff && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                      {selectedStaff.user.first_name[0]}{selectedStaff.user.last_name[0]}
                    </div>
                    <div>
                      <p className="text-xl font-semibold">
                        {selectedStaff.user.first_name} {selectedStaff.user.last_name}
                      </p>
                      <p className="text-gray-500">{selectedStaff.staff_code}</p>
                      {getAvailabilityBadge(selectedStaff.is_available)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-gray-500">Designation</p>
                      <p className="font-medium">{selectedStaff.designation}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{selectedStaff.user.email}</p>
                    </div>
                    {selectedStaff.user.phone && (
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium">{selectedStaff.user.phone}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-500">Max Credits/Shift</p>
                      <p className="font-medium">{selectedStaff.max_credits_per_shift}</p>
                    </div>
                  </div>

                  {selectedStaff.assigned_floors.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-gray-500 mb-2">Assigned Floors</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedStaff.assigned_floors.map(floor => (
                          <Badge key={floor} variant="outline">Floor {floor}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedStaff.skills.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-gray-500 mb-2">Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedStaff.skills.map(skill => (
                          <Badge key={skill} className="bg-violet-100 text-violet-800">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-violet-600">{selectedStaff.tasks_completed_today}</p>
                      <p className="text-xs text-gray-500">Today</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{selectedStaff.tasks_completed_month}</p>
                      <p className="text-xs text-gray-500">This Month</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${getScoreColor(selectedStaff.quality_score)}`}>
                        {selectedStaff.quality_score?.toFixed(1) || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">Quality Score</p>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Performance Modal */}
          <Dialog open={isPerformanceModalOpen} onOpenChange={setIsPerformanceModalOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Performance - {selectedStaff?.user.first_name} {selectedStaff?.user.last_name}</DialogTitle>
              </DialogHeader>

              {staffPerformance && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-5 gap-4">
                    <Card className="p-3 text-center">
                      <p className="text-2xl font-bold text-violet-600">{staffPerformance.summary.totalTasks}</p>
                      <p className="text-xs text-gray-500">Tasks</p>
                    </Card>
                    <Card className="p-3 text-center">
                      <p className="text-2xl font-bold">{staffPerformance.summary.avgCleaningTime}m</p>
                      <p className="text-xs text-gray-500">Avg Time</p>
                    </Card>
                    <Card className="p-3 text-center">
                      <p className={`text-2xl font-bold ${getScoreColor(staffPerformance.summary.avgQualityScore)}`}>
                        {staffPerformance.summary.avgQualityScore}
                      </p>
                      <p className="text-xs text-gray-500">Quality</p>
                    </Card>
                    <Card className="p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{staffPerformance.summary.punctualityRate}%</p>
                      <p className="text-xs text-gray-500">On Time</p>
                    </Card>
                    <Card className="p-3 text-center">
                      <p className="text-2xl font-bold">{staffPerformance.summary.totalCredits}</p>
                      <p className="text-xs text-gray-500">Credits</p>
                    </Card>
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-3">Daily Breakdown (Last 7 Days)</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3">Date</th>
                            <th className="text-center py-2 px-3">Tasks</th>
                            <th className="text-center py-2 px-3">Avg Time</th>
                            <th className="text-center py-2 px-3">Quality</th>
                            <th className="text-center py-2 px-3">Credits</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffPerformance.metrics.map((day: any) => (
                            <tr key={day.metric_date} className="border-b">
                              <td className="py-2 px-3">{new Date(day.metric_date).toLocaleDateString()}</td>
                              <td className="py-2 px-3 text-center">{day.tasks_completed}</td>
                              <td className="py-2 px-3 text-center">{day.avg_cleaning_time_minutes}m</td>
                              <td className="py-2 px-3 text-center">
                                <span className={getScoreColor(day.avg_quality_score)}>
                                  {day.avg_quality_score?.toFixed(1) || '-'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">{day.credits_earned}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
