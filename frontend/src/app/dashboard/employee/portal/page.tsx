'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import {
  User,
  FileText,
  Calendar,
  Clock,
  DollarSign,
  Download,
  Upload,
  Mail,
  Phone,
  MapPin,
  Award,
  Briefcase,
  GraduationCap,
  Heart,
  Shield,
  Edit,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { staffAPI } from '@/lib/api';

export default function EmployeePortal() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'payslips' | 'leave' | 'documents' | 'training'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);

  // Employee data from user context
  const employeeData = {
    employeeId: user?.id || 'EMP001',
    firstName: user?.firstName || 'Employee',
    lastName: user?.lastName || 'Doe',
    email: user?.email || 'john.doe@famousgate.com',
    phone: '+254 712 345 678',
    department: 'Front Office',
    position: 'Receptionist',
    joinDate: '2023-01-15',
    employmentType: 'Full-time',
    reportingTo: 'Sarah Manager',
    address: '123 Westlands, Nairobi',
    emergencyContact: {
      name: 'Mary Doe',
      relationship: 'Spouse',
      phone: '+254 723 456 789'
    },
    bankDetails: {
      accountName: 'John Doe',
      accountNumber: '****7890',
      bankName: 'KCB Bank'
    },
    leaveBalance: {
      annual: 14,
      sick: 5,
      personal: 2
    },
    totalLeavesTaken: 7,
    nextReviewDate: '2024-06-15'
  };

  // Fetch employee data from API
  const fetchEmployeeData = async () => {
    setIsLoading(true);
    try {
      const [payrollRes, leaveRes] = await Promise.all([
        staffAPI.getPayroll(user?.id).catch(() => ({ payslips: [] })),
        staffAPI.getLeaveHistory(user?.id).catch(() => ({ leaves: [] }))
      ]);

      const payslipData = payrollRes.payslips || payrollRes || [];
      const leaveData = leaveRes.leaves || leaveRes || [];

      if (Array.isArray(payslipData)) {
        setPayslips(payslipData.map((p: any) => ({
          id: p.id,
          month: p.month || new Date(p.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          date: p.date || p.created_at,
          amount: p.amount || p.net_salary || 0,
          status: p.status || 'paid'
        })));
      }

      if (Array.isArray(leaveData)) {
        setLeaveHistory(leaveData.map((l: any) => ({
          id: l.id,
          type: l.leave_type || 'Annual',
          from: l.start_date,
          to: l.end_date,
          days: l.days || 1,
          status: l.status || 'pending'
        })));
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchEmployeeData();
    }
  }, [user]);

  const documents: any[] = []; // Documents would come from API
  const trainings: any[] = []; // Trainings would come from API

  const handleLeaveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Leave request submitted successfully');
    setShowLeaveModal(false);
  };

  const handleProfileUpdate = () => {
    toast.success('Profile updated successfully');
    setIsEditing(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-10 w-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{employeeData.firstName} {employeeData.lastName}</h1>
                <p className="opacity-90">{employeeData.position} • {employeeData.department}</p>
                <p className="text-sm opacity-75">Employee ID: {employeeData.employeeId}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-75">Joined</p>
              <p className="font-semibold">{new Date(employeeData.joinDate).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg p-4 border border-gray-100"
          >
            <Calendar className="h-8 w-8 text-blue-600 mb-2" />
            <p className="text-2xl font-bold">{employeeData.leaveBalance.annual}</p>
            <p className="text-sm text-gray-600">Annual Leave Days</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg p-4 border border-gray-100"
          >
            <Heart className="h-8 w-8 text-red-600 mb-2" />
            <p className="text-2xl font-bold">{employeeData.leaveBalance.sick}</p>
            <p className="text-sm text-gray-600">Sick Leave Days</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg p-4 border border-gray-100"
          >
            <GraduationCap className="h-8 w-8 text-purple-600 mb-2" />
            <p className="text-2xl font-bold">{trainings.filter(t => t.status === 'completed').length}</p>
            <p className="text-sm text-gray-600">Trainings Completed</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg p-4 border border-gray-100"
          >
            <Award className="h-8 w-8 text-green-600 mb-2" />
            <p className="text-2xl font-bold">{trainings.filter(t => t.certificate).length}</p>
            <p className="text-sm text-gray-600">Certificates Earned</p>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'profile', label: 'My Profile', icon: User },
              { id: 'payslips', label: 'Payslips', icon: DollarSign },
              { id: 'leave', label: 'Leave', icon: Calendar },
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'training', label: 'Training', icon: GraduationCap }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleProfileUpdate}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-400" />
                  Basic Information
                </h3>
                <div className="space-y-3 pl-7">
                  <div>
                    <label className="text-sm text-gray-600">Full Name</label>
                    <p className="font-medium">{employeeData.firstName} {employeeData.lastName}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Email</label>
                    {isEditing ? (
                      <input
                        type="email"
                        defaultValue={employeeData.email}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="font-medium">{employeeData.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Phone</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        defaultValue={employeeData.phone}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="font-medium">{employeeData.phone}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Address</label>
                    {isEditing ? (
                      <textarea
                        defaultValue={employeeData.address}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        rows={2}
                      />
                    ) : (
                      <p className="font-medium">{employeeData.address}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-gray-400" />
                  Employment Details
                </h3>
                <div className="space-y-3 pl-7">
                  <div>
                    <label className="text-sm text-gray-600">Department</label>
                    <p className="font-medium">{employeeData.department}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Position</label>
                    <p className="font-medium">{employeeData.position}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Employment Type</label>
                    <p className="font-medium">{employeeData.employmentType}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Reporting To</label>
                    <p className="font-medium">{employeeData.reportingTo}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-gray-400" />
                  Emergency Contact
                </h3>
                <div className="space-y-3 pl-7">
                  <div>
                    <label className="text-sm text-gray-600">Contact Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        defaultValue={employeeData.emergencyContact.name}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="font-medium">{employeeData.emergencyContact.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Relationship</label>
                    {isEditing ? (
                      <input
                        type="text"
                        defaultValue={employeeData.emergencyContact.relationship}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="font-medium">{employeeData.emergencyContact.relationship}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Phone</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        defaultValue={employeeData.emergencyContact.phone}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <p className="font-medium">{employeeData.emergencyContact.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  Bank Details
                </h3>
                <div className="space-y-3 pl-7">
                  <div>
                    <label className="text-sm text-gray-600">Account Name</label>
                    <p className="font-medium">{employeeData.bankDetails.accountName}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Account Number</label>
                    <p className="font-medium">{employeeData.bankDetails.accountNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Bank Name</label>
                    <p className="font-medium">{employeeData.bankDetails.bankName}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payslips' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Payslips</h2>
            <div className="space-y-4">
              {payslips.map(payslip => (
                <div key={payslip.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <FileText className="h-10 w-10 text-indigo-600" />
                      <div>
                        <p className="font-medium text-gray-900">{payslip.month}</p>
                        <p className="text-sm text-gray-500">Generated on {payslip.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-gray-900">KES {payslip.amount.toLocaleString()}</p>
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          {payslip.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="View">
                          <FileText className="h-5 w-5" />
                        </button>
                        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Download">
                          <Download className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'leave' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Leave Management</h2>
                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Request Leave
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-700">Annual Leave Balance</p>
                  <p className="text-2xl font-bold text-blue-900">{employeeData.leaveBalance.annual} days</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-red-700">Sick Leave Balance</p>
                  <p className="text-2xl font-bold text-red-900">{employeeData.leaveBalance.sick} days</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-purple-700">Personal Leave Balance</p>
                  <p className="text-2xl font-bold text-purple-900">{employeeData.leaveBalance.personal} days</p>
                </div>
              </div>

              <h3 className="font-medium text-gray-900 mb-4">Leave History</h3>
              <div className="space-y-3">
                {leaveHistory.map(leave => (
                  <div key={leave.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{leave.type} Leave</p>
                        <p className="text-sm text-gray-500">
                          {leave.from} to {leave.to} • {leave.days} days
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                        leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {leave.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Document
              </button>
            </div>
            <div className="space-y-3">
              {documents.map(doc => (
                <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{doc.name}</p>
                        <p className="text-sm text-gray-500">{doc.type} • {doc.size} • Uploaded {doc.uploadDate}</p>
                      </div>
                    </div>
                    <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                      <Download className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'training' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Training & Certifications</h2>
            <div className="space-y-4">
              {trainings.map(training => (
                <div key={training.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <GraduationCap className={`h-10 w-10 ${
                        training.status === 'completed' ? 'text-green-600' :
                        training.status === 'in-progress' ? 'text-blue-600' :
                        'text-gray-400'
                      }`} />
                      <div>
                        <p className="font-medium text-gray-900">{training.name}</p>
                        <p className="text-sm text-gray-500">Scheduled: {training.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        training.status === 'completed' ? 'bg-green-100 text-green-800' :
                        training.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {training.status}
                      </span>
                      {training.certificate && (
                        <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Download Certificate">
                          <Award className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowLeaveModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-4">Request Leave</h2>
            <form onSubmit={handleLeaveRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                  <option>Annual Leave</option>
                  <option>Sick Leave</option>
                  <option>Personal Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Please provide a reason for your leave request..."
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </DashboardLayout>
  );
}
