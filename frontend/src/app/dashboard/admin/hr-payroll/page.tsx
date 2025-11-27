'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import {
  Users,
  DollarSign,
  Calendar,
  FileText,
  UserPlus,
  TrendingUp,
  Award,
  Clock,
  CreditCard,
  Download,
  Upload,
  Mail,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Briefcase,
  UserCheck,
  UserX
} from 'lucide-react';
import { toast } from 'sonner';
import type { Employee, Payroll, LeaveRequest, Attendance } from '@/types/system.types';

export default function HRPayrollPortal() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll' | 'leave' | 'attendance'>('employees');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));

  // API base URL
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch employees and leave requests
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`
        };

        // Fetch employees
        const employeesResponse = await fetch(`${API_URL}/api/employees`, {
          headers
        });

        if (!employeesResponse.ok) {
          throw new Error('Failed to fetch employees');
        }

        const employeesData = await employeesResponse.json();
        setEmployees(employeesData.data);

        // Fetch leave requests
        const leaveResponse = await fetch(`${API_URL}/api/leave-requests`, {
          headers
        });

        if (!leaveResponse.ok) {
          throw new Error('Failed to fetch leave requests');
        }

        const leaveData = await leaveResponse.json();
        setLeaveRequests(leaveData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to load HR data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const stats = {
    totalEmployees: employees.length,
    activeEmployees: employees.filter((e: Employee) => e.status === 'active').length,
    onLeave: employees.filter((e: Employee) => e.status === 'on-leave').length,
    monthlyPayroll: employees.reduce((sum: number, e: Employee) => {
      const totalAllowances = e.allowances.reduce((a: number, b) => a + b.amount, 0);
      return sum + e.baseSalary + totalAllowances;
    }, 0),
    pendingLeaves: leaveRequests.filter((l: LeaveRequest) => l.status === 'pending').length,
    departments: new Set(employees.map((e: Employee) => e.department)).size
  };

  const calculateNetPay = (employee: Employee) => {
    const totalAllowances = employee.allowances.reduce((sum, a) => sum + a.amount, 0);
    const grossPay = employee.baseSalary + totalAllowances;
    const tax = grossPay * 0.3; // 30% tax (simplified)
    const insurance = 1500;
    const pension = grossPay * 0.06; // 6% pension
    const totalDeductions = tax + insurance + pension;
    return {
      gross: grossPay,
      deductions: totalDeductions,
      net: grossPay - totalDeductions
    };
  };

  const handleProcessPayroll = () => {
    toast.success(`Payroll for ${payrollMonth} processed successfully`);
    setShowPayrollModal(false);
  };

  const handleApproveLeave = (leaveId: string) => {
    toast.success('Leave request approved');
  };

  const handleRejectLeave = (leaveId: string) => {
    toast.error('Leave request rejected');
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">HR & Payroll Management</h1>
              <p className="text-gray-600 mt-1">Employee management, payroll processing, and leave tracking</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </button>
              <button 
                onClick={() => setShowPayrollModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <DollarSign className="h-5 w-5" />
                Process Payroll
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add Employee
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg p-4 border border-gray-100"
            >
              <Users className="h-8 w-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{stats.totalEmployees}</p>
              <p className="text-sm text-gray-600">Total Employees</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-green-50 border border-green-200 rounded-lg p-4"
            >
              <UserCheck className="h-8 w-8 text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-900">{stats.activeEmployees}</p>
              <p className="text-sm text-green-700">Active</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
            >
              <UserX className="h-8 w-8 text-yellow-600 mb-2" />
              <p className="text-2xl font-bold text-yellow-900">{stats.onLeave}</p>
              <p className="text-sm text-yellow-700">On Leave</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg p-4"
            >
              <DollarSign className="h-8 w-8 mb-2" />
              <p className="text-xl font-bold">KES {(stats.monthlyPayroll / 1000).toFixed(0)}K</p>
              <p className="text-sm opacity-90">Monthly Payroll</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-lg p-4 border border-gray-100"
            >
              <Calendar className="h-8 w-8 text-purple-600 mb-2" />
              <p className="text-2xl font-bold">{stats.pendingLeaves}</p>
              <p className="text-sm text-gray-600">Pending Leaves</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-lg p-4 border border-gray-100"
            >
              <Briefcase className="h-8 w-8 text-indigo-600 mb-2" />
              <p className="text-2xl font-bold">{stats.departments}</p>
              <p className="text-sm text-gray-600">Departments</p>
            </motion.div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {['employees', 'payroll', 'leave', 'attendance'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab === 'leave' ? 'Leave Management' : tab}
                </button>
              ))}
            </nav>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'employees' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {employees.map((employee: Employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {employee.firstName} {employee.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{employee.employeeId}</p>
                            <p className="text-xs text-gray-500">{employee.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{employee.department}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{employee.position}</td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 capitalize">{employee.employmentType}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            KES {employee.baseSalary.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            + {employee.allowances.reduce((sum, a) => sum + a.amount, 0).toLocaleString()} allowances
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            employee.status === 'active' ? 'bg-green-100 text-green-800' :
                            employee.status === 'on-leave' ? 'bg-yellow-100 text-yellow-800' :
                            employee.status === 'suspended' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {employee.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setSelectedEmployee(employee)}
                              className="text-indigo-600 hover:text-indigo-900 text-sm"
                            >
                              View
                            </button>
                            <button className="text-gray-600 hover:text-gray-900 text-sm">Edit</button>
                            <button className="text-green-600 hover:text-green-900 text-sm">Payslip</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'payroll' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Payroll Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {employees.map((employee: Employee) => {
                    const pay = calculateNetPay(employee);
                    return (
                      <div key={employee.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {employee.firstName} {employee.lastName}
                            </p>
                            <p className="text-sm text-gray-500">{employee.position}</p>
                          </div>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            employee.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {employee.status}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Gross Pay:</span>
                            <span className="font-medium">KES {pay.gross.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Deductions:</span>
                            <span className="text-red-600">-KES {pay.deductions.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t">
                            <span className="font-medium">Net Pay:</span>
                            <span className="font-bold text-green-600">KES {pay.net.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <button className="flex-1 px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                            Generate Payslip
                          </button>
                          <button className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200">
                            <Mail className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors">
                    <CreditCard className="h-6 w-6 mb-2 mx-auto" />
                    <span className="text-sm">Process Payroll</span>
                  </button>
                  <button className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors">
                    <FileText className="h-6 w-6 mb-2 mx-auto" />
                    <span className="text-sm">Bulk Payslips</span>
                  </button>
                  <button className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors">
                    <BarChart3 className="h-6 w-6 mb-2 mx-auto" />
                    <span className="text-sm">Payroll Report</span>
                  </button>
                  <button className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors">
                    <Upload className="h-6 w-6 mb-2 mx-auto" />
                    <span className="text-sm">Import Data</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'leave' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Leave Requests</h2>
                <div className="space-y-4">
                  {leaveRequests.map((leave: LeaveRequest) => {
                    const employee = employees.find((e: Employee) => e.employeeId === leave.employeeId);
                    return (
                      <div key={leave.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {employee?.firstName} {employee?.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {leave.leaveType} leave • {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">{leave.reason}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                              leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {leave.status}
                            </span>
                            {leave.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveLeave(leave.id)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                >
                                  <CheckCircle className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleRejectLeave(leave.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <AlertCircle className="h-5 w-5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="text-center text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-4" />
                <p>Attendance Management</p>
                <p className="text-sm mt-2">Track employee attendance, shifts, and overtime</p>
              </div>
            </div>
          )}
        </div>

        {/* Payroll Processing Modal */}
        {showPayrollModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPayrollModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Process Payroll</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payroll Month
                  </label>
                  <input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Payroll Amount:</p>
                  <p className="text-2xl font-bold text-gray-900">KES {stats.monthlyPayroll.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 mt-1">{stats.activeEmployees} active employees</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPayrollModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProcessPayroll}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Process Payroll
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
