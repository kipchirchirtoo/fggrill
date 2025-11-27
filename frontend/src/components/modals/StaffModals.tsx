'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Save, User, Mail, Phone, Calendar,
  Building, Clock, DollarSign, Award,
  FileText, UserPlus, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialData?: any;
}

export function StaffModal({ isOpen, onClose, mode = 'create', initialData }: StaffModalProps) {
  const [staffData, setStaffData] = useState(initialData || {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    shift: 'morning',
    salary: '',
    startDate: '',
    idNumber: '',
    emergencyContact: '',
    address: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStaffData((prev: any) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      // TODO: Implement API call
      const response = await fetch('/api/staff', {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffData)
      });

      if (!response.ok) throw new Error('Failed to save staff member');
      
      toast.success('Staff member ' + (mode === 'create' ? 'added' : 'updated') + ' successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to save staff member');
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
        className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === 'create' ? 'Add Staff Member' : 'Edit Staff Member'}
            </h2>
            <p className="text-sm text-gray-500">Fill in the staff member details</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={staffData.firstName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={staffData.lastName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={staffData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={staffData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building className="h-5 w-5" />
              Employment Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  name="role"
                  value={staffData.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  name="department"
                  value={staffData.department}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Department</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="reception">Reception</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="finance">Finance</option>
                  <option value="management">Management</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shift
                </label>
                <select
                  name="shift"
                  value={staffData.shift}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="morning">Morning (06:00 - 14:00)</option>
                  <option value="evening">Evening (14:00 - 22:00)</option>
                  <option value="night">Night (22:00 - 06:00)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={staffData.startDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4 md:col-span-2">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Additional Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID Number
                </label>
                <input
                  type="text"
                  name="idNumber"
                  value={staffData.idNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emergency Contact
                </label>
                <input
                  type="tel"
                  name="emergencyContact"
                  value={staffData.emergencyContact}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  name="address"
                  value={staffData.address}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Save className="inline h-4 w-4 mr-2" />
            {mode === 'create' ? 'Add Staff Member' : 'Update Staff Member'}
          </button>
        </div>
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
      // TODO: Implement API call
      const response = await fetch('/api/staff/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scheduleData,
          staff: selectedStaff
        })
      });

      if (!response.ok) throw new Error('Failed to schedule staff');
      
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
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
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
      // TODO: Implement API call
      const response = await fetch('/api/staff/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payrollData,
          staff: selectedStaff
        })
      });

      if (!response.ok) throw new Error('Failed to process payroll');
      
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
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
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
      // TODO: Implement API call
      const response = await fetch('/api/staff/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: staff?.id,
          ...performanceData
        })
      });

      if (!response.ok) throw new Error('Failed to submit performance review');
      
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
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
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
                    className={'px-4 py-2 rounded-lg border-2 ' + (
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Provide detailed feedback..."
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Award className="inline h-4 w-4 mr-2" />
            Submit Review
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
