'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Search, UserPlus, RefreshCw, Users, UserCheck, CalendarClock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Staff member interface
interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  position: string;
  department: string;
  status: string;
  national_id?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

interface StatutoryDeductions {
  nssf: number;
  shif: number;
  housing: number;
}

function BranchStaffManagementContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showViewStaffModal, setShowViewStaffModal] = useState(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState(false);
  const [showDeductionsModal, setShowDeductionsModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    national_id: '',
    status: 'active'
  });

  // Statutory data
  const [deductionsData, setDeductionsData] = useState<StatutoryDeductions>({
    nssf: 0,
    shif: 0,
    housing: 0
  });
  const [deductionsMonth, setDeductionsMonth] = useState(new Date().getMonth() + 1);
  const [deductionsYear, setDeductionsYear] = useState(new Date().getFullYear());

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    onLeave: 0,
    departments: 0
  });

  useEffect(() => {
    if (activeBranchId) {
      fetchStaff();
    }
  }, [activeBranchId]);

  useEffect(() => {
    applyFilters();
  }, [staff, searchTerm, departmentFilter, statusFilter]);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const response = await branchOperationsAPI.getStaff(
        {
          department: departmentFilter !== 'all' ? departmentFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        },
        activeBranchId ?? undefined
      );

      if (response.success) {
        const staffData = response.data || [];
        setStaff(staffData);

        // Calculate stats
        const departments = [...new Set(staffData.map((s: StaffMember) => s.department))].length;
        const active = staffData.filter((s: StaffMember) => s.status === 'active').length;
        const onLeave = staffData.filter((s: StaffMember) => s.status === 'on_leave').length;

        setStats({
          total: staffData.length,
          active,
          onLeave,
          departments
        });
      } else {
        throw new Error(response.message || 'Failed to fetch staff data');
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff data');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...staff];

    // Apply department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(person => person.department === departmentFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(person => person.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(person =>
        person.name.toLowerCase().includes(searchLower) ||
        person.position.toLowerCase().includes(searchLower) ||
        person.department.toLowerCase().includes(searchLower)
      );
    }

    setFilteredStaff(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <IOSBadge className="bg-green-100 text-green-700">Active</IOSBadge>;
      case 'inactive':
        return <IOSBadge className="bg-red-100 text-red-700">Inactive</IOSBadge>;
      case 'on_leave':
        return <IOSBadge className="bg-blue-100 text-blue-700">On Leave</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{status}</IOSBadge>;
    }
  };

  const handleOpenAddStaff = () => {
    setFormData({
      id: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      national_id: '',
      status: 'active'
    });
    setShowAddStaffModal(true);
  };

  const handleCloseModal = () => {
    setShowAddStaffModal(false);
    setShowViewStaffModal(false);
    setShowEditStaffModal(false);
    setShowDeductionsModal(false);
    setSelectedStaff(null);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await branchOperationsAPI.createStaffMember(
        formData,
        activeBranchId ?? undefined
      );

      if (response.success) {
        toast.success('Staff member added successfully!');
        handleCloseModal();
        fetchStaff(); // Refresh the list
      } else {
        throw new Error(response.message || 'Failed to add staff member');
      }
    } catch (error: any) {
      console.error('Error creating staff member:', error);
      toast.error(error.message || 'Failed to add staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewStaff = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setShowViewStaffModal(true);
  };

  const handleEditStaff = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setFormData({
      id: staff.id,
      first_name: staff.first_name || '',
      last_name: staff.last_name || '',
      email: staff.email || '',
      phone: staff.phone || '',
      position: staff.position,
      department: staff.department,
      national_id: staff.national_id || '',
      status: staff.status
    });
    setShowEditStaffModal(true);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await branchOperationsAPI.updateStaffMember(
        formData.id,
        formData,
        activeBranchId ?? undefined
      );

      if (response.success) {
        toast.success('Staff member updated successfully!');
        handleCloseModal();
        fetchStaff(); // Refresh the list
      } else {
        throw new Error(response.message || 'Failed to update staff member');
      }
    } catch (error: any) {
      console.error('Error updating staff member:', error);
      toast.error(error.message || 'Failed to update staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeductions = async (staff: StaffMember) => {
    setSelectedStaff(staff);
    setShowDeductionsModal(true);

    // Fetch existing deductions
    try {
      const response = await branchOperationsAPI.getStatutoryDeductions({
        staffId: staff.id,
        month: deductionsMonth,
        year: deductionsYear
      }, activeBranchId ?? undefined);

      if (response.success && response.data && response.data.length > 0) {
        const record = response.data[0];
        setDeductionsData({
          nssf: Number(record.nssf_amount || 0),
          shif: Number(record.shif_amount || 0),
          housing: Number(record.housing_fund_amount || 0)
        });
      } else {
        setDeductionsData({ nssf: 0, shif: 0, housing: 0 });
      }
    } catch (error) {
      console.error('Error fetching deductions:', error);
    }
  };

  const handleSaveDeductions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setIsSubmitting(true);
    try {
      const response = await branchOperationsAPI.saveStatutoryDeductions({
        staff_id: selectedStaff.id,
        branch_id: activeBranchId,
        month: deductionsMonth,
        year: deductionsYear,
        nssf_amount: deductionsData.nssf,
        shif_amount: deductionsData.shif,
        housing_fund_amount: deductionsData.housing
      }, activeBranchId ?? undefined);

      if (response.success) {
        toast.success('Deductions saved successfully!');
        setShowDeductionsModal(false);
      } else {
        throw new Error(response.message || 'Failed to save deductions');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save deductions');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.SUPER_ADMIN,
      UserRole.BRANCH_ACCOUNTANT,
      UserRole.HR_MANAGER,
      UserRole.GENERAL_MANAGER,
      UserRole.AUDITOR
    ]}>
      <BranchAwareDashboardLayout
        title="Staff Management"
        subtitle={`Manage staff for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton leftIcon={<UserPlus />} onClick={handleOpenAddStaff}>
            Add Staff
          </IOSButton>
        }
      >
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <Users className="h-5 w-5 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">Total Staff</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <UserCheck className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-lg font-bold text-green-600">{stats.active}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <CalendarClock className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-gray-500">On Leave</p>
              <p className="text-lg font-bold text-blue-600">{stats.onLeave}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <Users className="h-5 w-5 text-purple-600 mb-2" />
              <p className="text-sm text-gray-500">Departments</p>
              <p className="text-lg font-bold text-purple-600">{stats.departments}</p>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Departments</option>
                  <option value="reception">Reception</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="bar_lounge">Bar & Lounge</option>
                  <option value="security">Security</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="management">Management</option>
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>

              <div>
                <IOSButton
                  onClick={fetchStaff}
                  leftIcon={<RefreshCw />}
                  className="w-full"
                >
                  Refresh
                </IOSButton>
              </div>
            </div>
          </IOSCard>

          {/* Staff Table */}
          <IOSCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                      </td>
                    </tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <Users className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-gray-500">No staff found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((person) => (
                      <tr key={person.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 mr-3">
                              {person.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{person.name}</p>
                              <p className="text-xs text-gray-500">{person.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {person.position}
                        </td>
                        <td className="px-4 py-4">
                          {person.department}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(person.status)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex justify-center space-x-2">
                            <IOSButton
                              size="sm"
                              variant="secondary"
                              onClick={() => handleViewStaff(person)}
                            >
                              View
                            </IOSButton>
                            <IOSButton
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditStaff(person)}
                            >
                              Edit
                            </IOSButton>
                            <IOSButton
                              size="sm"
                              className="bg-stone-800 text-white"
                              onClick={() => handleOpenDeductions(person)}
                            >
                              Deductions
                            </IOSButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>
      </BranchAwareDashboardLayout>

      {/* View Staff Modal */}
      <Dialog open={showViewStaffModal} onOpenChange={setShowViewStaffModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Staff Details</DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-4">
              <div className="flex flex-col items-center pb-4">
                <div className="h-20 w-20 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-2xl font-bold mb-2">
                  {selectedStaff.name.charAt(0)}
                </div>
                <h3 className="text-lg font-bold">{selectedStaff.name}</h3>
                <p className="text-stone-500">{selectedStaff.position}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-stone-50 p-3 rounded-lg">
                  <p className="text-stone-400 mb-1">Department</p>
                  <p className="font-medium capitalize">{selectedStaff.department}</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-lg">
                  <p className="text-stone-400 mb-1">Status</p>
                  <div>{getStatusBadge(selectedStaff.status)}</div>
                </div>
                <div className="bg-stone-50 p-3 rounded-lg">
                  <p className="text-stone-400 mb-1">Email</p>
                  <p className="font-medium truncate">{selectedStaff.email || 'N/A'}</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-lg">
                  <p className="text-stone-400 mb-1">Phone</p>
                  <p className="font-medium">{selectedStaff.phone || 'N/A'}</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-lg col-span-2">
                  <p className="text-stone-400 mb-1">National ID</p>
                  <p className="font-medium">{selectedStaff.national_id || 'N/A'}</p>
                </div>
              </div>

              <DialogFooter>
                <IOSButton variant="outline" onClick={handleCloseModal}>
                  Close
                </IOSButton>
                <IOSButton onClick={() => {
                  setShowViewStaffModal(false);
                  handleEditStaff(selectedStaff);
                }}>
                  Edit Details
                </IOSButton>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Staff Modal */}
      <Dialog open={showEditStaffModal} onOpenChange={setShowEditStaffModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update details for {selectedStaff?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateStaff} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-first_name">First Name *</Label>
                <Input
                  id="edit-first_name"
                  required
                  value={formData.first_name}
                  onChange={(e) => handleFormChange('first_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last_name">Last Name *</Label>
                <Input
                  id="edit-last_name"
                  required
                  value={formData.last_name}
                  onChange={(e) => handleFormChange('last_name', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-national_id">National ID *</Label>
              <Input
                id="edit-national_id"
                required
                value={formData.national_id}
                onChange={(e) => handleFormChange('national_id', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone Number *</Label>
              <Input
                id="edit-phone"
                required
                value={formData.phone}
                onChange={(e) => handleFormChange('phone', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-position">Position *</Label>
              <Input
                id="edit-position"
                required
                value={formData.position}
                onChange={(e) => handleFormChange('position', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-department">Department *</Label>
              <select
                id="edit-department"
                required
                value={formData.department}
                onChange={(e) => handleFormChange('department', e.target.value)}
                className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
              >
                <option value="">Select Department</option>
                <option value="reception">Reception</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="kitchen">Kitchen</option>
                <option value="restaurant">Restaurant</option>
                <option value="bar_lounge">Bar & Lounge</option>
                <option value="security">Security</option>
                <option value="maintenance">Maintenance</option>
                <option value="management">Management</option>
                <option value="finance">Finance</option>
                <option value="administration">Administration</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <select
                id="edit-status"
                value={formData.status}
                onChange={(e) => handleFormChange('status', e.target.value)}
                className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>

            <DialogFooter>
              <IOSButton
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Cancel
              </IOSButton>
              <IOSButton
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Update Staff Member'}
              </IOSButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Staff Modal */}
      <Dialog open={showAddStaffModal} onOpenChange={setShowAddStaffModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            {/* Reuse same fields as edit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-first_name">First Name *</Label>
                <Input
                  id="add-first_name"
                  required
                  value={formData.first_name}
                  onChange={(e) => handleFormChange('first_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-last_name">Last Name *</Label>
                <Input
                  id="add-last_name"
                  required
                  value={formData.last_name}
                  onChange={(e) => handleFormChange('last_name', e.target.value)}
                />
              </div>
            </div>
            {/* ... other fields omitted for brevity but I'll add them to be safe */}
            <div className="space-y-2">
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-phone">Phone *</Label>
              <Input
                id="add-phone"
                required
                value={formData.phone}
                onChange={(e) => handleFormChange('phone', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-position">Position *</Label>
              <Input
                id="add-position"
                required
                value={formData.position}
                onChange={(e) => handleFormChange('position', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-department">Department *</Label>
              <select
                id="add-department"
                required
                value={formData.department}
                onChange={(e) => handleFormChange('department', e.target.value)}
                className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
              >
                <option value="">Select Department</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="kitchen">Kitchen</option>
                <option value="restaurant">Restaurant</option>
                <option value="bar_lounge">Bar & Lounge</option>
                <option value="security">Security</option>
                <option value="maintenance">Maintenance</option>
                <option value="management">Management</option>
                <option value="finance">Finance</option>
              </select>
            </div>
            <DialogFooter>
              <IOSButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Staff Member'}
              </IOSButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Statutory Deductions Modal */}
      <Dialog open={showDeductionsModal} onOpenChange={setShowDeductionsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Monthly Statutory Deductions</DialogTitle>
            <DialogDescription>
              Set NSSF, SHIF, and Housing Fund for {selectedStaff?.name} for {new Date(deductionsYear, deductionsMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDeductions} className="space-y-4 pt-2">
            <div className="space-y-4 bg-stone-50 p-4 rounded-xl border border-stone-100">
              <div className="space-y-2">
                <Label htmlFor="nssf_amount">NSSF Amount (KES)</Label>
                <Input
                  id="nssf_amount"
                  type="number"
                  value={deductionsData.nssf}
                  onChange={(e) => setDeductionsData({ ...deductionsData, nssf: Number(e.target.value) })}
                  className="bg-white border-stone-200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shif_amount">SHIF Amount (KES)</Label>
                <Input
                  id="shif_amount"
                  type="number"
                  value={deductionsData.shif}
                  onChange={(e) => setDeductionsData({ ...deductionsData, shif: Number(e.target.value) })}
                  className="bg-white border-stone-200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="housing_amount">Housing Fund Amount (KES)</Label>
                <Input
                  id="housing_amount"
                  type="number"
                  value={deductionsData.housing}
                  onChange={(e) => setDeductionsData({ ...deductionsData, housing: Number(e.target.value) })}
                  className="bg-white border-stone-200"
                />
              </div>
            </div>

            <div className="text-[11px] text-stone-400 bg-amber-50 p-2 rounded border border-amber-100 italic">
              Note: These amounts will be deducted from {selectedStaff?.name}'s next payroll for this month.
            </div>

            <DialogFooter>
              <IOSButton
                type="button"
                variant="outline"
                onClick={() => setShowDeductionsModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </IOSButton>
              <IOSButton
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Deductions'}
              </IOSButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}

// Export a wrapper component that provides BranchContext
export default function BranchStaffManagementPage() {
  return (
    <BranchPageWrapper>
      <BranchStaffManagementContent />
    </BranchPageWrapper>
  );
}
