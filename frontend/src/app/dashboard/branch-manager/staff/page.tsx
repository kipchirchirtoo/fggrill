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

const DEPARTMENTS = [
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'reception', label: 'Reception' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'finance', label: 'Finance' },
  { value: 'management', label: 'Management' },
  { value: 'security', label: 'Security' },
  { value: 'bar_lounge', label: 'Bar & Lounge' },
  { value: 'administration', label: 'Administration' },
  { value: 'general', label: 'General' },
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
    phone_number: '',
    national_id: '',
    department: '',
    position: '',
    employee_id: ''
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
          first_name: s.first_name || s.user?.first_name || '',
          last_name: s.last_name || s.user?.last_name || '',
          email: s.email || s.user?.email || '',
          phone: s.phone || s.user?.phone_number || '',
          role: s.position || s.role || s.department || 'Staff',
          department: s.department || '',
          national_id: s.national_id || '',
          status: s.status || 'active',
          employee_id: s.employee_id || s.id_number || '',
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
      const response = await staffAPI.clockIn({
        staff_id: staffId,
        in_method: 'manual',
        device_id: 'MANAGER_UI'
      });
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
      const response = await staffAPI.clockOut({
        staff_id: staffId,
        out_method: 'manual',
        device_id: 'MANAGER_UI'
      });
      if (response.success) {
        toast.success('Clocked out successfully');
        fetchAttendance();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to clock out');
    }
  };

  const getAttendanceStatus = (staffId: string) => {
    const records = attendance.filter(a => a.staff_id === staffId);

    // 1. Check for any open shift first (spanning shifts)
    const openShift = records.find(a => !a.clock_out);
    if (openShift) {
      return {
        status: 'Clocked In',
        canClockIn: false,
        canClockOut: true,
        time: openShift.clock_in
      };
    }

    // 2. Check if they completed a shift TODAY
    const today = new Date().toISOString().split('T')[0];
    const latestToday = records
      .filter(a => a.attendance_date === today)
      .sort((a, b) => new Date(b.clock_out || '').getTime() - new Date(a.clock_out || '').getTime())[0];

    if (!latestToday) return { status: 'Not Clocked In', canClockIn: true, canClockOut: false };

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
      phone_number: '',
      national_id: '',
      department: '',
      position: '',
      employee_id: ''
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
      phone_number: member.phone || (member as any).phone_number || '',
      national_id: (member as any).national_id || '',
      department: (member as any).department || '',
      position: (member as any).position || member.role || '',
      employee_id: member.employee_id || (member as any).id_number || ''
    });
    setEditingStaff(member);
    setShowStaffModal(true);
  };

  const handleSubmitStaff = async () => {
    if (!staffForm.first_name || !staffForm.last_name || !staffForm.national_id || !staffForm.department) {
      toast.error('Please fill in required fields: Name, National ID, Department');
      return;
    }

    if (!editingStaff && isLimitReached) {
      toast.error(`Staff limit reached. Branch managers can only add up to ${STAFF_LIMIT} staff members.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Map frontend field names to backend expected field names (snake_case)
      const staffData = {
        first_name: staffForm.first_name,
        last_name: staffForm.last_name,
        email: staffForm.email || null,
        phone: staffForm.phone_number || null,
        national_id: staffForm.national_id,
        department: staffForm.department,
        position: staffForm.position,
        branch_id: currentBranchId,
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
    return roleValue;
  };

  const getRolesByCategory = () => {
    return {};
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
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
                  <option value="all">All Departments ({staff.length})</option>
                  {DEPARTMENTS.map(dept => (
                    <option key={dept.value} value={dept.value}>{dept.label}</option>
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
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
              <DialogHeader className="px-6 py-4 border-b border-stone-100 bg-white">
                <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  {editingStaff ? 'Refine Staff Profile' : 'Onboard New Staff Member'}
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Personal Information Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Personal Details</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">First Name *</label>
                      <Input
                        value={staffForm.first_name}
                        onChange={(e) => setStaffForm({ ...staffForm, first_name: e.target.value })}
                        placeholder="First name"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Last Name *</label>
                      <Input
                        value={staffForm.last_name}
                        onChange={(e) => setStaffForm({ ...staffForm, last_name: e.target.value })}
                        placeholder="Last name"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">National ID *</label>
                      <Input
                        value={staffForm.national_id}
                        onChange={(e) => setStaffForm({ ...staffForm, national_id: e.target.value })}
                        placeholder="Enter National ID"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Email Address</label>
                      <Input
                        type="email"
                        value={staffForm.email}
                        onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                        placeholder="email@example.com"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Phone Number</label>
                      <Input
                        type="tel"
                        value={staffForm.phone_number}
                        onChange={(e) => setStaffForm({ ...staffForm, phone_number: e.target.value })}
                        placeholder="Phone"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Professional Details Section */}
                <div className="space-y-4 pt-4 border-t border-stone-100">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Employment Details</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Department *</label>
                      <select
                        value={staffForm.department}
                        onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                        className="w-full h-11 border border-stone-200 rounded-xl px-4 text-sm bg-white focus:ring-2 focus:ring-stone-900 outline-none"
                      >
                        <option value="">Select Department</option>
                        {DEPARTMENTS.map(dept => (
                          <option key={dept.value} value={dept.value}>{dept.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Position / Function</label>
                      <Input
                        value={staffForm.position}
                        onChange={(e) => setStaffForm({ ...staffForm, position: e.target.value })}
                        placeholder="e.g. Head Chef, Room Attendant"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Employee ID / Serial No.</label>
                      <Input
                        value={staffForm.employee_id}
                        onChange={(e) => setStaffForm({ ...staffForm, employee_id: e.target.value })}
                        placeholder="e.g. EMP-001"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-4">
                <IOSButton
                  variant="secondary"
                  onClick={() => { setShowStaffModal(false); resetStaffForm(); }}
                  className="flex-1 h-12 text-base font-semibold"
                >
                  Discard Changes
                </IOSButton>
                <IOSButton
                  onClick={handleSubmitStaff}
                  disabled={isSubmitting}
                  className="flex-1 h-12 text-base font-semibold"
                >
                  {isSubmitting ? 'Processing...' : editingStaff ? 'Save Changes' : 'Confirm Onboarding'}
                </IOSButton>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
