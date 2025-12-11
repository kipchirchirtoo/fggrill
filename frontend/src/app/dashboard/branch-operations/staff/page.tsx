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
  name: string;
  position: string;
  department: string;
  status: string;
  email?: string;
  phone?: string;
  avatar?: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    status: 'active'
  });

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
    setShowAddStaffModal(true);
  };

  const handleCloseModal = () => {
    setShowAddStaffModal(false);
    setShowViewStaffModal(false);
    setShowEditStaffModal(false);
    setSelectedStaff(null);
    setFormData({
      id: '',
      name: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      status: 'active'
    });
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
      name: staff.name,
      email: staff.email || '',
      phone: staff.phone || '',
      position: staff.position,
      department: staff.department,
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

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Departments</option>
                  <option value="Front Office">Front Office</option>
                  <option value="Housekeeping">Housekeeping</option>
                  <option value="Kitchen">Kitchen</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Security">Security</option>
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

      {/* Add Staff Modal */}
      <Dialog open={showAddStaffModal} onOpenChange={setShowAddStaffModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <DialogDescription>
              Fill in the details to add a new staff member to {activeBranch?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleFormChange('email', e.target.value)}
                placeholder="john.doe@famousgate.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                required
                value={formData.phone}
                onChange={(e) => handleFormChange('phone', e.target.value)}
                placeholder="+254712345678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Position *</Label>
              <Input
                id="position"
                required
                value={formData.position}
                onChange={(e) => handleFormChange('position', e.target.value)}
                placeholder="e.g., Receptionist, Chef, Waiter"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <select
                id="department"
                required
                value={formData.department}
                onChange={(e) => handleFormChange('department', e.target.value)}
                className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
              >
                <option value="">Select Department</option>
                <option value="Front Office">Front Office</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Kitchen">Kitchen</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Bar & Lounge">Bar & Lounge</option>
                <option value="Security">Security</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Management">Management</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
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
                {isSubmitting ? 'Adding...' : 'Add Staff Member'}
              </IOSButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* View Staff Modal */}
      <Dialog open={showViewStaffModal} onOpenChange={setShowViewStaffModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Staff Details</DialogTitle>
          </DialogHeader>
          
          {selectedStaff && (
            <div className="space-y-6">
              {/* Staff Profile Header */}
              <div className="flex items-center gap-4 mb-4">
                <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-xl font-semibold text-gray-500">
                  {selectedStaff.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{selectedStaff.name}</h3>
                  <p className="text-gray-500">{selectedStaff.position}</p>
                  <div className="mt-1">
                    {getStatusBadge(selectedStaff.status)}
                  </div>
                </div>
              </div>
              
              {/* Staff Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Department</p>
                  <p className="font-medium">{selectedStaff.department}</p>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-medium">{selectedStaff.email || 'Not provided'}</p>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="font-medium">{selectedStaff.phone || 'Not provided'}</p>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="font-medium capitalize">{selectedStaff.status}</p>
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
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                required
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
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
                <option value="Front Office">Front Office</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Kitchen">Kitchen</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Bar & Lounge">Bar & Lounge</option>
                <option value="Security">Security</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Management">Management</option>
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
