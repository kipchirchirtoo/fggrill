'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { staffAPI } from '@/lib/api';
import { Users, RefreshCw, Search, User, Mail, Phone, Building2, Plus, Edit2, Trash2, UserPlus, Clock, LogIn, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  status: 'active' | 'inactive';
  employee_id?: string;
  pos_pin?: string;
  created_at?: string;
}

const STAFF_ROLES = [
  // Management
  { value: 'general_manager', label: 'General Manager', category: 'Management' },
  { value: 'branch_manager', label: 'Branch Manager', category: 'Management' },
  { value: 'restaurant_manager', label: 'Restaurant Manager', category: 'Management' },

  // Front Office & Reception
  { value: 'receptionist', label: 'Receptionist', category: 'Front Office' },
  { value: 'front_desk_supervisor', label: 'Front Desk Supervisor', category: 'Front Office' },
  { value: 'concierge', label: 'Concierge', category: 'Front Office' },
  { value: 'bell_captain', label: 'Bell Captain', category: 'Front Office' },
  { value: 'bellhop', label: 'Bellhop', category: 'Front Office' },

  // Restaurant & Food Service
  { value: 'restaurant', label: 'Restaurant Staff', category: 'Restaurant' },
  { value: 'head_chef', label: 'Head Chef', category: 'Kitchen' },
  { value: 'sous_chef', label: 'Sous Chef', category: 'Kitchen' },
  { value: 'line_cook', label: 'Line Cook', category: 'Kitchen' },
  { value: 'prep_cook', label: 'Prep Cook', category: 'Kitchen' },
  { value: 'waiter', label: 'Waiter', category: 'Restaurant' },
  { value: 'waitress', label: 'Waitress', category: 'Restaurant' },
  { value: 'head_waiter', label: 'Head Waiter', category: 'Restaurant' },
  { value: 'bartender', label: 'Bartender', category: 'Restaurant' },
  { value: 'barista', label: 'Barista', category: 'Restaurant' },
  { value: 'food_runner', label: 'Food Runner', category: 'Restaurant' },
  { value: 'busser', label: 'Busser', category: 'Restaurant' },
  { value: 'host_hostess', label: 'Host/Hostess', category: 'Restaurant' },
  { value: 'pos_kitchen', label: 'POS Kitchen', category: 'Kitchen' },
  { value: 'kitchen_helper', label: 'Kitchen Helper', category: 'Kitchen' },
  { value: 'dishwasher', label: 'Dishwasher', category: 'Kitchen' },

  // Housekeeping
  { value: 'housekeeping', label: 'Housekeeping', category: 'Housekeeping' },
  { value: 'housekeeping_supervisor', label: 'Housekeeping Supervisor', category: 'Housekeeping' },
  { value: 'room_attendant', label: 'Room Attendant', category: 'Housekeeping' },
  { value: 'laundry_attendant', label: 'Laundry Attendant', category: 'Housekeeping' },

  // Maintenance
  { value: 'maintenance', label: 'Maintenance', category: 'Maintenance' },
  { value: 'maintenance_supervisor', label: 'Maintenance Supervisor', category: 'Maintenance' },
  { value: 'electrician', label: 'Electrician', category: 'Maintenance' },
  { value: 'plumber', label: 'Plumber', category: 'Maintenance' },
  { value: 'hvac_technician', label: 'HVAC Technician', category: 'Maintenance' },
  { value: 'groundskeeper', label: 'Groundskeeper', category: 'Maintenance' },

  // Security
  { value: 'security_supervisor', label: 'Security Supervisor', category: 'Security' },
  { value: 'security_guard', label: 'Security Guard', category: 'Security' },
  { value: 'night_auditor', label: 'Night Auditor', category: 'Security' },

  // Administration
  { value: 'accountant', label: 'Accountant', category: 'Finance' },
  { value: 'finance_manager', label: 'Finance Manager', category: 'Finance' },
  { value: 'hr_manager', label: 'HR Manager', category: 'Administration' },
  { value: 'payroll_clerk', label: 'Payroll Clerk', category: 'Administration' },

  // Store & Inventory
  { value: 'central_storekeeper', label: 'Central Storekeeper', category: 'Inventory' },
  { value: 'branch_storekeeper', label: 'Branch Storekeeper', category: 'Inventory' },
  { value: 'inventory_clerk', label: 'Inventory Clerk', category: 'Inventory' },
  { value: 'purchasing_manager', label: 'Purchasing Manager', category: 'Inventory' },

  // General
  { value: 'employee', label: 'General Employee', category: 'General' }
];

export default function BranchStaffPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  // Modal states
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [staffForm, setStaffForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    employee_id: '',
    pos_pin: '',
    role: 'employee'
  });

  const STAFF_LIMIT = 10;
  const isLimitReached = user?.role === UserRole.BRANCH_MANAGER && staff.length >= STAFF_LIMIT;

  // Use active branch from context, fallback to user's branch
  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchStaff = useCallback(async () => {
    if (!currentBranchId) {
      setStaff([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await staffAPI.getStaff(currentBranchId);
      if (response.success) {
        // Map backend response to frontend format
        const mappedStaff = (response.data || []).map((s: any) => ({
          id: s.id,
          first_name: s.user?.first_name || s.first_name || '',
          last_name: s.user?.last_name || s.last_name || '',
          email: s.user?.email || s.email || '',
          phone: s.user?.phone_number || s.phone || '',
          role: s.role || s.department || 'employee',
          status: s.status || 'active',
          employee_id: s.employee_id || '',
          pos_pin: s.user?.pos_pin || s.pos_pin || '',
          created_at: s.created_at
        }));
        setStaff(mappedStaff);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load staff data');
    }
    finally { setIsLoading(false); }
  }, [currentBranchId]);

  const fetchAttendance = useCallback(async () => {
    if (!currentBranchId) return;
    setIsAttendanceLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await staffAPI.getAttendance({ branch_id: currentBranchId, date: today });
      if (response.success) {
        setAttendance(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setIsAttendanceLoading(false);
    }
  }, [currentBranchId]);

  useEffect(() => {
    fetchStaff();
    fetchAttendance();
  }, [fetchStaff, fetchAttendance]);

  const handleClockIn = async (staffId: string) => {
    try {
      const response = await staffAPI.clockIn(staffId);
      if (response.success) {
        toast.success('Clocked in successfully');
        fetchAttendance();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock in');
    }
  };

  const handleClockOut = async (staffId: string) => {
    try {
      const response = await staffAPI.clockOut(staffId);
      if (response.success) {
        toast.success('Clocked out successfully');
        fetchAttendance();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock out');
    }
  };

  const getAttendanceStatus = (staffId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const records = attendance.filter(a => a.staff_id === staffId);

    // Find the latest record for today
    const todayRecords = records.filter(a => a.attendance_date === today);
    const latestToday = todayRecords.sort((a, b) =>
      new Date(b.clock_in || '').getTime() - new Date(a.clock_in || '').getTime()
    )[0];

    if (!latestToday) return { status: 'Not Clocked In', canClockIn: true, canClockOut: false };
    if (!latestToday.clock_out) return { status: 'Clocked In', canClockIn: false, canClockOut: true, time: latestToday.clock_in };

    // If clocked out today, they can clock in again for a second shift
    return { status: 'Completed Shift', canClockIn: true, canClockOut: false, time: latestToday.clock_out };
  };

  const filteredStaff = staff.filter((s) => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employee_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const resetStaffForm = () => {
    setStaffForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      employee_id: '',
      pos_pin: '',
      role: 'employee'
    });
    setEditingStaff(null);
  };

  const handleAddStaff = () => {
    resetStaffForm();
    setShowStaffModal(true);
  };

  const handleEditStaff = (member: Staff) => {
    setStaffForm({
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      phone: member.phone || '',
      employee_id: member.employee_id || '',
      pos_pin: member.pos_pin || '',
      role: member.role
    });
    setEditingStaff(member);
    setShowStaffModal(true);
  };

  const handleSubmitStaff = async () => {
    if (!staffForm.first_name || !staffForm.last_name || !staffForm.email || !staffForm.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!editingStaff && isLimitReached) {
      toast.error(`Staff limit reached. Branch managers can only add up to ${STAFF_LIMIT} staff members.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Map frontend field names to backend expected field names
      const staffData = {
        firstName: staffForm.first_name,
        lastName: staffForm.last_name,
        email: staffForm.email,
        phone: staffForm.phone,
        role: staffForm.role,
        department: staffForm.role, // Use role as department for now
        employeeId: staffForm.employee_id,
        pos_pin: staffForm.pos_pin || null,
        branchId: currentBranchId,
        status: 'active'
      };

      if (editingStaff) {
        await staffAPI.updateStaffMember(editingStaff.id, staffData);
        toast.success('Staff member updated successfully');
      } else {
        await staffAPI.createStaffMember(staffData);
        toast.success('Staff member added successfully');
      }

      setShowStaffModal(false);
      resetStaffForm();
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async (member: Staff) => {
    if (!confirm(`Are you sure you want to delete ${member.first_name} ${member.last_name}?`)) {
      return;
    }

    try {
      await staffAPI.deleteStaffMember(member.id);
      toast.success('Staff member deleted successfully');
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete staff member');
    }
  };

  const getRoleLabel = (roleValue: string) => {
    const role = STAFF_ROLES.find(r => r.value === roleValue);
    return role ? role.label : roleValue;
  };

  const getRolesByCategory = () => {
    const categories: { [key: string]: typeof STAFF_ROLES } = {};

    // Filter roles based on user role
    const filteredRoles = STAFF_ROLES.filter(role => {
      if (user?.role === UserRole.BRANCH_MANAGER) {
        // Branch Manager can only add restaurant and hotel employees
        // Exclude management and high-level admin roles
        const excludedRoles = [
          'super_admin',
          'general_manager',
          'branch_manager',
          'finance_manager',
          'hr_manager',
          'central_storekeeper'
        ];
        return !excludedRoles.includes(role.value);
      }
      return true; // Super Admin and General Manager can see all roles
    });

    filteredRoles.forEach(role => {
      if (!categories[role.category]) {
        categories[role.category] = [];
      }
      categories[role.category].push(role);
    });
    return categories;
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
              <p className="text-gray-500 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch?.name || 'Select a branch'}
              </p>
            </div>
            <div className="flex gap-2">
              {!isLimitReached && (
                <button
                  onClick={handleAddStaff}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Staff
                </button>
              )}
              {isLimitReached && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded border border-amber-200 text-xs font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Staff Limit Reached (10)
                </div>
              )}
              <button
                onClick={fetchStaff}
                className="px-3 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Role Filter */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Filter by Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="all">All Roles ({staff.length})</option>
                  {Object.entries(getRolesByCategory()).map(([category, roles]) => (
                    <optgroup key={category} label={category}>
                      {roles.map(role => {
                        const count = staff.filter(s => s.role === role.value).length;
                        return (
                          <option key={role.value} value={role.value}>
                            {role.label} ({count})
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <input
                type="text"
                placeholder="Search staff by name, role, or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-gray-500">Loading staff data...</div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <p className="text-gray-500 mb-4">No staff found</p>
              <button
                onClick={handleAddStaff}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 flex items-center gap-2 mx-auto"
              >
                <UserPlus className="h-4 w-4" />
                Add First Staff Member
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStaff.map((member) => {
                const attendanceStatus = getAttendanceStatus(member.id);

                return (
                  <div key={member.id} className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-l-transparent hover:border-l-blue-500">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-600 font-bold text-lg shadow-inner">
                            {member.first_name?.[0]}{member.last_name?.[0]}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${member.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                            }`} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{member.first_name} {member.last_name}</p>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{getRoleLabel(member.role)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditStaff(member)}
                          className="p-2 rounded-xl hover:bg-blue-50 text-blue-600 transition-colors"
                          title="Edit staff member"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(member)}
                          className="p-2 rounded-xl hover:bg-red-50 text-red-500 transition-colors"
                          title="Delete staff member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 mb-5">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      {member.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      {member.employee_id && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-mono text-xs bg-gray-50 px-2 py-0.5 rounded">ID: {member.employee_id}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Attendance</span>
                        {attendanceStatus.status === 'Clocked In' ? (
                          <div className="flex items-center gap-1.5 text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">Clocked In: {attendanceStatus.time ? format(new Date(attendanceStatus.time), 'HH:mm') : '--:--'}</span>
                          </div>
                        ) : attendanceStatus.status === 'Completed Shift' ? (
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">Out: {attendanceStatus.time ? format(new Date(attendanceStatus.time), 'HH:mm') : '--:--'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-500">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">Not Clocked In</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {attendanceStatus.canClockIn ? (
                          <button
                            onClick={() => handleClockIn(member.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors shadow-sm"
                          >
                            <LogIn className="h-3.5 w-3.5" />
                            {attendanceStatus.status === 'Completed Shift' ? 'Next Shift' : 'Clock In'}
                          </button>
                        ) : attendanceStatus.canClockOut ? (
                          <button
                            onClick={() => handleClockOut(member.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors shadow-sm"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            Clock Out
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add/Edit Staff Modal */}
          <Dialog open={showStaffModal} onOpenChange={setShowStaffModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">First Name *</label>
                    <input
                      type="text"
                      value={staffForm.first_name}
                      onChange={(e) => setStaffForm({ ...staffForm, first_name: e.target.value })}
                      className="w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Last Name *</label>
                    <input
                      type="text"
                      value={staffForm.last_name}
                      onChange={(e) => setStaffForm({ ...staffForm, last_name: e.target.value })}
                      className="w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    placeholder="Email address"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Role *</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    className="w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  >
                    {Object.entries(getRolesByCategory()).map(([category, roles]) => (
                      <optgroup key={category} label={category}>
                        {roles.map(role => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
                  <input
                    type="tel"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    className="w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">POS PIN (Waiters: RXXX, Bar: BXXX)</label>
                  <input
                    type="text"
                    value={staffForm.pos_pin}
                    maxLength={4}
                    onChange={(e) => setStaffForm({ ...staffForm, pos_pin: e.target.value.toUpperCase() })}
                    className="w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white font-mono"
                    placeholder="e.g. R123"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => { setShowStaffModal(false); resetStaffForm(); }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitStaff}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : editingStaff ? 'Update' : 'Add Staff'}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
