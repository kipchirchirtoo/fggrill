'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  Clock,
  Calendar,
  DollarSign,
  Award,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  Mail,
  Phone,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  StaffModal,
  ScheduleModal,
  PayrollModal,
  PerformanceModal
} from '@/components/modals/StaffModals';

export default function AdminStaffPage() {
  const { user } = useAuth();
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');

  const staffStats = {
    totalStaff: 24,
    onDuty: 18,
    onLeave: 3,
    newHires: 2,
    departments: 6,
    averagePerformance: 87
  };

  const staffMembers = [
    {
      id: 1,
      name: 'Mary Kamau',
      role: 'Housekeeping Supervisor',
      department: 'Housekeeping',
      status: 'active',
      shift: 'Morning',
      performance: 92,
      phone: '+254 712 345 678',
      email: 'mary.k@famousgate.com',
      joinDate: '2022-03-15'
    },
    {
      id: 2,
      name: 'John Mwangi',
      role: 'Head Chef',
      department: 'Restaurant',
      status: 'active',
      shift: 'Morning',
      performance: 88,
      phone: '+254 723 456 789',
      email: 'john.m@famousgate.com',
      joinDate: '2021-06-20'
    },
    {
      id: 3,
      name: 'Sarah Wanjiru',
      role: 'Front Desk Manager',
      department: 'Reception',
      status: 'active',
      shift: 'Morning',
      performance: 95,
      phone: '+254 734 567 890',
      email: 'sarah.w@famousgate.com',
      joinDate: '2020-01-10'
    },
    {
      id: 4,
      name: 'Peter Njoroge',
      role: 'Maintenance Technician',
      department: 'Maintenance',
      status: 'on-leave',
      shift: 'Evening',
      performance: 85,
      phone: '+254 745 678 901',
      email: 'peter.n@famousgate.com',
      joinDate: '2023-02-28'
    },
    {
      id: 5,
      name: 'Grace Ochieng',
      role: 'Accountant',
      department: 'Finance',
      status: 'active',
      shift: 'Morning',
      performance: 90,
      phone: '+254 756 789 012',
      email: 'grace.o@famousgate.com',
      joinDate: '2022-08-15'
    }
  ];

  const departments = [
    { name: 'Housekeeping', staff: 6, color: 'bg-blue-500' },
    { name: 'Restaurant', staff: 8, color: 'bg-green-500' },
    { name: 'Reception', staff: 4, color: 'bg-purple-500' },
    { name: 'Maintenance', staff: 3, color: 'bg-orange-500' },
    { name: 'Finance', staff: 2, color: 'bg-red-500' },
    { name: 'Management', staff: 1, color: 'bg-indigo-500' }
  ];

  const upcomingShifts = [
    { time: '06:00 - 14:00', type: 'Morning', staff: 8 },
    { time: '14:00 - 22:00', type: 'Evening', staff: 7 },
    { time: '22:00 - 06:00', type: 'Night', staff: 3 }
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
              <p className="text-gray-600 mt-1">Manage employees and work schedules</p>
            </div>
            <button
              onClick={() => setShowAddStaffModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <UserPlus className="h-5 w-5" />
              Add Staff Member
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <Users className="h-8 w-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{staffStats.totalStaff}</p>
              <p className="text-sm text-gray-600">Total Staff</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-900">{staffStats.onDuty}</p>
              <p className="text-sm text-green-700">On Duty</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <AlertCircle className="h-8 w-8 text-yellow-600 mb-2" />
              <p className="text-2xl font-bold text-yellow-900">{staffStats.onLeave}</p>
              <p className="text-sm text-yellow-700">On Leave</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <UserPlus className="h-8 w-8 text-purple-600 mb-2" />
              <p className="text-2xl font-bold">{staffStats.newHires}</p>
              <p className="text-sm text-gray-600">New Hires</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <Award className="h-8 w-8 text-indigo-600 mb-2" />
              <p className="text-2xl font-bold">{staffStats.departments}</p>
              <p className="text-sm text-gray-600">Departments</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <Award className="h-8 w-8 text-green-600 mb-2" />
              <p className="text-2xl font-bold">{staffStats.averagePerformance}%</p>
              <p className="text-sm text-gray-600">Avg Performance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Staff List */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Staff Directory</h2>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search staff..."
                        className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div className="relative">
                      <select
                        value={filterDepartment}
                        onChange={(e) => setFilterDepartment(e.target.value)}
                        className="appearance-none pl-3 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="all">All Departments</option>
                        <option value="housekeeping">Housekeeping</option>
                        <option value="restaurant">Restaurant</option>
                        <option value="reception">Reception</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="finance">Finance</option>
                        <option value="management">Management</option>
                      </select>
                      <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {staffMembers
                      .filter(member =>
                        (filterDepartment === 'all' || member.department.toLowerCase() === filterDepartment) &&
                        (searchTerm === '' ||
                          member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.department.toLowerCase().includes(searchTerm.toLowerCase()))
                      )
                      .map(member => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{member.name}</p>
                            <p className="text-xs text-gray-500">{member.role}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{member.department}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            member.status === 'active' ? 'bg-green-100 text-green-800' :
                            member.status === 'on-leave' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {member.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full ${
                                  member.performance >= 90 ? 'bg-green-500' :
                                  member.performance >= 70 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${member.performance}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{member.performance}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => window.location.href = 'mailto:' + member.email}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => window.location.href = 'tel:' + member.phone}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <Phone className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedStaff(member);
                                setShowEditStaffModal(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Department Distribution */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h3>
                <div className="space-y-3">
                  {departments.map(dept => (
                    <div key={dept.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${dept.color}`} />
                        <span className="text-sm text-gray-700">{dept.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{dept.staff} staff</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Today's Shifts */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Shifts</h3>
                <div className="space-y-3">
                  {upcomingShifts.map(shift => (
                    <div key={shift.type} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{shift.type} Shift</span>
                        <span className="text-sm text-gray-600">{shift.staff} staff</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {shift.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="w-full bg-white/20 backdrop-blur-sm rounded-lg p-3 hover:bg-white/30 transition-colors text-left"
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Schedule Manager
                  </button>
                  <button
                    onClick={() => setShowPayrollModal(true)}
                    className="w-full bg-white/20 backdrop-blur-sm rounded-lg p-3 hover:bg-white/30 transition-colors text-left"
                  >
                    <DollarSign className="h-4 w-4 inline mr-2" />
                    Payroll Processing
                  </button>
                  <button
                    onClick={() => setShowPerformanceModal(true)}
                    className="w-full bg-white/20 backdrop-blur-sm rounded-lg p-3 hover:bg-white/30 transition-colors text-left"
                  >
                    <Award className="h-4 w-4 inline mr-2" />
                    Performance Reviews
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Staff Modals */}
        <StaffModal
          isOpen={showAddStaffModal}
          onClose={() => setShowAddStaffModal(false)}
          mode="create"
        />
        <StaffModal
          isOpen={showEditStaffModal}
          onClose={() => {
            setShowEditStaffModal(false);
            setSelectedStaff(null);
          }}
          mode="edit"
          initialData={selectedStaff}
        />
        <ScheduleModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
        />
        <PayrollModal
          isOpen={showPayrollModal}
          onClose={() => setShowPayrollModal(false)}
        />
        <PerformanceModal
          isOpen={showPerformanceModal}
          onClose={() => setShowPerformanceModal(false)}
          staff={selectedStaff}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
