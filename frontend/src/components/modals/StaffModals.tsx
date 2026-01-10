'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Save, User, Mail, Phone, Calendar,
  Building, Clock, DollarSign, Award,
  FileText, UserPlus, CheckCircle, Key,
  Copy, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '@/lib/auth-context';
import { systemAPI, staffAPI } from '@/lib/api';

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialData?: any;
  onSuccess?: () => void;
}

interface Role {
  value: string;
  label: string;
  description: string;
}

export function StaffModal({ isOpen, onClose, mode = 'create', initialData, onSuccess }: StaffModalProps) {
  const [staffData, setStaffData] = useState(initialData || {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    role: '',
    branchId: '',
    password: ''
  });

  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Available roles from UserRole enum
  const availableRoles = [
    { value: UserRole.RECEPTIONIST, label: 'Receptionist', description: 'Front desk operations' },
    { value: UserRole.HOUSEKEEPING, label: 'Housekeeping', description: 'Room cleaning and maintenance' },
    { value: UserRole.HOUSEKEEPING_SUPERVISOR, label: 'Housekeeping Supervisor', description: 'Housekeeping team lead' },
    { value: UserRole.RESTAURANT, label: 'Restaurant Staff', description: 'Kitchen and dining operations' },
    { value: UserRole.BARTENDER, label: 'Bartender', description: 'Bar and beverage service' },
    { value: UserRole.MAINTENANCE, label: 'Maintenance', description: 'Facility maintenance' },
    { value: UserRole.ACCOUNTANT, label: 'Accountant', description: 'Financial operations' },
    { value: UserRole.AUDITOR, label: 'Auditor', description: 'Financial auditing' },
    { value: UserRole.CENTRAL_STOREKEEPER, label: 'Central Storekeeper', description: 'Central warehouse management' },
    { value: UserRole.BRANCH_STOREKEEPER, label: 'Branch Storekeeper', description: 'Branch inventory management' },
    { value: UserRole.BRANCH_MANAGER, label: 'Branch Manager', description: 'Branch operations management' },
    { value: UserRole.EMPLOYEE, label: 'General Employee', description: 'General staff member' }
  ];

  useEffect(() => {
    if (isOpen) {
      fetchBranches();
      if (mode === 'create') {
        generatePassword();
      }
    }
  }, [isOpen, mode]);

  const fetchBranches = async () => {
    setIsLoadingData(true);
    try {
      const branchesRes = await systemAPI.getBranches().catch(() => ({ data: [] }));
      setBranches(branchesRes.data || branchesRes.branches || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setIsLoadingData(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setStaffData((prev: any) => ({ ...prev, password }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStaffData((prev: any) => ({
      ...prev,
      [name]: value
    }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Password copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy password');
    }
  };

  const handleSubmit = async () => {
    if (!staffData.firstName || !staffData.lastName || !staffData.email || !staffData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (mode === 'create' && !staffData.password) {
      toast.error('Password is required');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'create') {
        await staffAPI.createStaffMember({
          first_name: staffData.firstName,
          last_name: staffData.lastName,
          email: staffData.email,
          phone_number: staffData.phoneNumber,
          role: staffData.role,
          branch_id: staffData.branchId ? parseInt(staffData.branchId) : null,
          password: staffData.password
        });
        toast.success('Staff member created successfully!');
      } else if (initialData?.id) {
        await staffAPI.updateStaffMember(initialData.id, {
          first_name: staffData.firstName,
          last_name: staffData.lastName,
          email: staffData.email,
          phone_number: staffData.phoneNumber,
          role: staffData.role,
          branch_id: staffData.branchId ? parseInt(staffData.branchId) : (initialData.branch_id || null)
        });
        toast.success('Staff member updated successfully!');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving staff member:', error);
      toast.error(error.message || 'Failed to save staff member');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStaffData({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      role: '',
      branchId: '',
      password: ''
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === 'create' ? 'Add Staff Member' : 'Edit Staff Member'}
            </h2>
            <p className="text-sm text-gray-500">Fill in the staff member details</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="ml-2 text-gray-600">Loading form data...</span>
          </div>
        ) : (
          <>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={staffData.firstName}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={staffData.lastName}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={staffData.email}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={staffData.phoneNumber}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  {mode === 'create' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={staffData.password}
                            onChange={handleChange}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-ios-lg hover:bg-indigo-200 flex items-center gap-1"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Generate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Employment Details */}
              <div className="space-y-4">
                <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Employment Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="role"
                      value={staffData.role}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Role</option>
                      {availableRoles.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    {staffData.role && (
                      <p className="text-xs text-gray-500 mt-1">
                        {availableRoles.find(r => r.value === staffData.role)?.description}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Branch Assignment
                    </label>
                    <select
                      name="branchId"
                      value={staffData.branchId}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">All Branches (Global)</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} ({branch.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
              <button
                onClick={handleClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-ios-lg hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isLoading ? 'Saving...' : (mode === 'create' ? 'Create Staff Member' : 'Update Staff Member')}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export function ScheduleModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [scheduleData, setScheduleData] = useState({
    shift: 'morning',
    date: '',
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setScheduleData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      await staffAPI.createSchedule({ ...scheduleData, staff: selectedStaff });
      toast.success('Staff schedule updated successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to update schedule');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Schedule Staff</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shift
            </label>
            <select
              name="shift"
              value={scheduleData.shift}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            >
              <option value="morning">Morning (06:00 - 14:00)</option>
              <option value="evening">Evening (14:00 - 22:00)</option>
              <option value="night">Night (22:00 - 06:00)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              name="date"
              value={scheduleData.date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff Members
            </label>
            <div className="space-y-2">
              {['Mary K.', 'John M.', 'Sarah W.', 'Peter N.'].map(staff => (
                <label key={staff} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedStaff.includes(staff)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStaff(prev => [...prev, staff]);
                      } else {
                        setSelectedStaff(prev => prev.filter(s => s !== staff));
                      }
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{staff}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={scheduleData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
          >
            <Clock className="inline h-4 w-4 mr-2" />
            Schedule Staff
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function PayrollModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [payrollData, setPayrollData] = useState({
    month: '',
    year: new Date().getFullYear(),
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPayrollData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      await staffAPI.processPayroll({ ...payrollData, staff: selectedStaff });
      toast.success('Payroll processed successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to process payroll');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Process Payroll</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Month
              </label>
              <select
                name="month"
                value={payrollData.month}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
              >
                <option value="">Select Month</option>
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <input
                type="number"
                name="year"
                value={payrollData.year}
                onChange={handleChange}
                min={2020}
                max={2100}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff Members
            </label>
            <div className="space-y-2">
              {['Mary K.', 'John M.', 'Sarah W.', 'Peter N.'].map(staff => (
                <label key={staff} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedStaff.includes(staff)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStaff(prev => [...prev, staff]);
                      } else {
                        setSelectedStaff(prev => prev.filter(s => s !== staff));
                      }
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{staff}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={payrollData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
          >
            <DollarSign className="inline h-4 w-4 mr-2" />
            Process Payroll
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function PerformanceModal({ isOpen, onClose, staff }: { isOpen: boolean; onClose: () => void; staff?: any }) {
  const [performanceData, setPerformanceData] = useState({
    rating: 5,
    attendance: 5,
    punctuality: 5,
    teamwork: 5,
    customerService: 5,
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPerformanceData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      await staffAPI.submitPerformanceReview({ staff_id: staff?.id, ...performanceData });
      toast.success('Performance review submitted successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to submit review');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Performance Review</h2>
            {staff && (
              <p className="text-sm text-gray-500">{staff.name} - {staff.role}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {['Rating', 'Attendance', 'Punctuality', 'Teamwork', 'Customer Service'].map((category) => (
            <div key={category}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {category}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setPerformanceData(prev => ({
                      ...prev,
                      [category.toLowerCase()]: rating
                    }))}
                    className={'px-4 py-2 rounded-ios-lg border-2 ' + (
                      performanceData[category.toLowerCase() as keyof typeof performanceData] === rating
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes & Feedback
            </label>
            <textarea
              name="notes"
              value={performanceData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
              placeholder="Provide detailed feedback..."
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
          >
            <Award className="inline h-4 w-4 mr-2" />
            Submit Review
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
