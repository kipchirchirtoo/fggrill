'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { userAPI, systemAPI } from '@/lib/api';
import { Users, RefreshCw, Plus, Search, Edit2, Trash2, User, Mail, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface UserData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  branch_id?: number;
  branch_name?: string;
  phone_number?: string;
  pos_pin?: string;
  status: 'active' | 'inactive';
}

// Role display names mapping
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.GENERAL_MANAGER]: 'General Manager',
  [UserRole.BRANCH_MANAGER]: 'Branch Manager',
  [UserRole.CENTRAL_STOREKEEPER]: 'Central Storekeeper',
  [UserRole.BRANCH_STOREKEEPER]: 'Branch Storekeeper',
  [UserRole.HOUSEKEEPING]: 'Housekeeping',
  [UserRole.HOUSEKEEPING_SUPERVISOR]: 'Housekeeping Supervisor',
  [UserRole.MAINTENANCE]: 'Maintenance',
  [UserRole.BRANCH_OPERATIONS_MANAGER]: 'Branch Operations Manager',
  [UserRole.CENTRAL_OPERATIONS_MANAGER]: 'Central Operations Manager',
  [UserRole.FACILITIES_MANAGER]: 'Facilities Manager',
  [UserRole.RECEPTIONIST]: 'Receptionist',
  [UserRole.RESTAURANT]: 'Restaurant',
  [UserRole.POS_KITCHEN]: 'POS Kitchen',
  [UserRole.BARTENDER]: 'Bartender',
  [UserRole.ACCOUNTANT]: 'Accountant',
  [UserRole.AUDITOR]: 'Auditor',
  [UserRole.EMPLOYEE]: 'Employee',
  [UserRole.GUEST]: 'Guest',
};

// Roles that require branch assignment
const BRANCH_REQUIRED_ROLES = [
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.HOUSEKEEPING,
  UserRole.HOUSEKEEPING_SUPERVISOR,
  UserRole.MAINTENANCE,
  UserRole.BRANCH_OPERATIONS_MANAGER,
  UserRole.RECEPTIONIST,
  UserRole.RESTAURANT,
  UserRole.POS_KITCHEN,
  UserRole.BARTENDER,
  UserRole.EMPLOYEE,
];

// Roles that should NOT have branch assignment (central/global roles)
const CENTRAL_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.CENTRAL_OPERATIONS_MANAGER,
  UserRole.FACILITIES_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.AUDITOR,
];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [branches, setBranches] = useState<{ id: number, name: string, code: string, status?: string }[]>([]);
  const [formData, setFormData] = useState({ id: '', email: '', first_name: '', last_name: '', role: '', branch_id: '', password: '', phone_number: '', pos_pin: '', status: 'active' });

  // Get all available roles from the UserRole enum
  const availableRoles = useMemo(() => {
    return Object.values(UserRole).map((role: string) => ({
      id: role,
      name: role,
      displayName: ROLE_DISPLAY_NAMES[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    }));
  }, []);

  // Check if selected role requires branch
  const selectedRoleRequiresBranch = useMemo(() => {
    return BRANCH_REQUIRED_ROLES.includes(formData.role as UserRole);
  }, [formData.role]);

  // Check if selected role is a central role (should not have branch)
  const selectedRoleIsCentral = useMemo(() => {
    return CENTRAL_ROLES.includes(formData.role as UserRole);
  }, [formData.role]);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [roleFilter, setRoleFilter] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, branchesRes] = await Promise.all([
        userAPI.getUsers(),
        systemAPI.getBranches(),
      ]);
      if (usersRes.success) setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      if (branchesRes.success) setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter ? u.role === roleFilter : true;

    return matchesSearch && matchesRole;
  });

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Email is invalid';

    if (!formData.first_name) errors.first_name = 'First name is required';
    if (!formData.role) errors.role = 'Role is required';

    // Validate branch assignment for roles that require it
    if (selectedRoleRequiresBranch && !formData.branch_id) {
      errors.branch_id = `${ROLE_DISPLAY_NAMES[formData.role as UserRole] || 'This role'} requires a branch assignment`;
    }

    // Ensure central roles don't have branch assignment
    if (selectedRoleIsCentral && formData.branch_id) {
      errors.branch_id = `${ROLE_DISPLAY_NAMES[formData.role as UserRole] || 'This role'} should not have a branch assignment (it's a central role)`;
    }

    if (!formData.id && !formData.password) errors.password = 'Password is required';
    else if (!formData.id && formData.password.length < 6) errors.password = 'Password must be at least 6 characters';

    // Validate POS PIN format if provided
    if (formData.pos_pin) {
      const pinRegex = /^[RB]\d{3}$/;
      if (!pinRegex.test(formData.pos_pin)) {
        errors.pos_pin = 'PIN must be 4 characters (e.g., R123 or B123)';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({ id: '', email: '', first_name: '', last_name: '', role: '', branch_id: '', password: '', phone_number: '', pos_pin: '', status: 'active' });
    setFormErrors({});
  };

  const handleEditUser = (user: UserData) => {
    setFormData({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name || '',
      role: user.role,
      branch_id: user.branch_id?.toString() || '',
      password: '',
      phone_number: user.phone_number || '',
      pos_pin: user.pos_pin || '',
      status: user.status
    });
    setEditModalOpen(true);
  };

  const handleDeleteUser = (user: UserData) => {
    setFormData({ ...formData, id: user.id });
    setConfirmDeleteOpen(true);
  };

  const handleCreateUser = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Transform field names to match backend expectations
      const payload = {
        email: formData.email,
        password: formData.password,
        firstName: formData.first_name,
        lastName: formData.last_name,
        role: formData.role,
        branchId: formData.branch_id ? parseInt(formData.branch_id) : null,
        phoneNumber: formData.phone_number || null,
        pos_pin: formData.pos_pin || null,
        status: formData.status,
      };

      const response = await userAPI.createUser(payload);
      if (response.success) {
        toast.success('User created successfully');
        setAddModalOpen(false);
        resetForm();
        fetchUsers();
      } else {
        toast.error(response.message || 'Failed to create user');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Transform field names to match backend expectations
      const payload: any = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: formData.role,
        branch_id: formData.branch_id ? parseInt(formData.branch_id) : null,
        phone_number: formData.phone_number || null,
        pos_pin: formData.pos_pin || null,
        status: formData.status,
      };

      // Don't send password if it's empty (no change)
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await userAPI.updateUser(formData.id, payload);
      if (response.success) {
        toast.success('User updated successfully');
        setEditModalOpen(false);
        resetForm();
        fetchUsers();
      } else {
        toast.error(response.message || 'Failed to update user');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsSubmitting(true);
    try {
      await userAPI.deleteUser(formData.id);
      toast.success('User deleted successfully');
      setConfirmDeleteOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Users</h1><p className="text-gray-500">Manage system users</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchUsers} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add User</IOSButton>
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to first page on search
                  }}
                  className="pl-9"
                />
              </div>
              <div>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1); // Reset to first page on filter change
                  }}
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="">All Roles</option>
                  {availableRoles.map((r) => <option key={r.id} value={r.name}>{r.displayName}</option>)}
                </select>
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredUsers.length === 0 ? (
            <IOSCard className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No users found</p></IOSCard>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-medium">User</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Role</th>
                      <th className="text-left p-3 font-medium">Branch</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredUsers
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-4 w-4 text-[#007AFF]" /></div>
                              <span className="font-medium">{u.first_name} {u.last_name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-gray-500">{u.email}</td>
                          <td className="p-3"><IOSBadge variant="light" color="info">{ROLE_DISPLAY_NAMES[u.role] || u.role}</IOSBadge></td>
                          <td className="p-3 text-gray-500">{u.branch_name || 'All'}</td>
                          <td className="p-3 text-center"><IOSBadge color={u.status === 'active' ? 'success' : 'secondary'}>{u.status}</IOSBadge></td>
                          <td className="p-3 text-right flex justify-end space-x-1">
                            <IOSButton
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditUser(u)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:bg-red-50"
                              onClick={() => handleDeleteUser(u)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IOSButton>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredUsers.length > itemsPerPage && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    Showing {Math.min(filteredUsers.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredUsers.length, currentPage * itemsPerPage)} of {filteredUsers.length} users
                  </div>
                  <div className="flex gap-1">
                    <IOSButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </IOSButton>

                    {Array.from({ length: Math.ceil(filteredUsers.length / itemsPerPage) }).map((_, idx) => (
                      <IOSButton
                        key={idx}
                        size="sm"
                        variant={currentPage === idx + 1 ? 'primary' : 'secondary'}
                        onClick={() => setCurrentPage(idx + 1)}
                        className="w-9"
                      >
                        {idx + 1}
                      </IOSButton>
                    )).slice(
                      Math.max(0, currentPage - 3),
                      Math.min(Math.ceil(filteredUsers.length / itemsPerPage), currentPage + 2)
                    )}

                    <IOSButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredUsers.length / itemsPerPage), prev + 1))}
                      disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
                    >
                      Next
                    </IOSButton>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Show</span>
                    <select
                      className="border rounded-md p-1"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1); // Reset to first page when changing items per page
                      }}
                    >
                      {[5, 10, 25, 50].map(value => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add User Dialog */}
        <Dialog open={addModalOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setAddModalOpen(open);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name <span className="text-red-500">*</span></label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className={formErrors.first_name ? 'border-red-500' : ''}
                  />
                  {formErrors.first_name && <p className="text-red-500 text-xs mt-1">{formErrors.first_name}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={formErrors.email ? 'border-red-500' : ''}
                />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Password <span className="text-red-500">*</span></label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={formErrors.password ? 'border-red-500' : ''}
                />
                {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Role <span className="text-red-500">*</span></label>
                <select
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    // Clear branch_id if selecting a central role
                    if (CENTRAL_ROLES.includes(newRole as UserRole)) {
                      setFormData({ ...formData, role: newRole, branch_id: '' });
                    } else {
                      setFormData({ ...formData, role: newRole });
                    }
                  }}
                  className={`w-full p-2 border rounded-ios-lg ${formErrors.role ? 'border-red-500' : ''}`}
                >
                  <option value="">Select role</option>
                  {availableRoles.map((r) => <option key={r.id} value={r.name}>{r.displayName}</option>)}
                </select>
                {formErrors.role && <p className="text-red-500 text-xs mt-1">{formErrors.role}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">
                  Branch {selectedRoleRequiresBranch && <span className="text-red-500">*</span>}
                  {selectedRoleIsCentral && <span className="text-gray-400 text-xs ml-1">(Central role - no branch)</span>}
                </label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  className={`w-full p-2 border rounded-ios-lg ${selectedRoleRequiresBranch && !formData.branch_id ? 'border-amber-400' : ''}`}
                  disabled={selectedRoleIsCentral}
                >
                  <option value="">{selectedRoleIsCentral ? 'N/A - Central Role' : 'All Branches'}</option>
                  {branches.filter(b => b.status !== 'inactive').map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
                {selectedRoleRequiresBranch && !formData.branch_id && (
                  <p className="text-amber-500 text-xs mt-1">This role typically requires a branch assignment</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="+254 7XX XXX XXX"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-blue-600">POS PIN (Waiters: RXXX, Bar: BXXX)</label>
                <Input
                  value={formData.pos_pin}
                  onChange={(e) => setFormData({ ...formData, pos_pin: e.target.value.toUpperCase() })}
                  placeholder="e.g. R123"
                  maxLength={4}
                  className={formErrors.pos_pin ? 'border-red-500' : ''}
                />
                {formErrors.pos_pin && <p className="text-red-500 text-xs mt-1">{formErrors.pos_pin}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1" disabled={isSubmitting}>Cancel</IOSButton>
                <IOSButton onClick={handleCreateUser} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={editModalOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setEditModalOpen(open);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name <span className="text-red-500">*</span></label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className={formErrors.first_name ? 'border-red-500' : ''}
                  />
                  {formErrors.first_name && <p className="text-red-500 text-xs mt-1">{formErrors.first_name}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={formErrors.email ? 'border-red-500' : ''}
                />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Password (Leave empty to keep current)</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={formErrors.password ? 'border-red-500' : ''}
                  placeholder="••••••••"
                />
                {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Role <span className="text-red-500">*</span></label>
                <select
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    // Clear branch_id if selecting a central role
                    if (CENTRAL_ROLES.includes(newRole as UserRole)) {
                      setFormData({ ...formData, role: newRole, branch_id: '' });
                    } else {
                      setFormData({ ...formData, role: newRole });
                    }
                  }}
                  className={`w-full p-2 border rounded-ios-lg ${formErrors.role ? 'border-red-500' : ''}`}
                >
                  <option value="">Select role</option>
                  {availableRoles.map((r) => <option key={r.id} value={r.name}>{r.displayName}</option>)}
                </select>
                {formErrors.role && <p className="text-red-500 text-xs mt-1">{formErrors.role}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">
                  Branch {selectedRoleRequiresBranch && <span className="text-red-500">*</span>}
                  {selectedRoleIsCentral && <span className="text-gray-400 text-xs ml-1">(Central role - no branch)</span>}
                </label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  className={`w-full p-2 border rounded-ios-lg ${selectedRoleRequiresBranch && !formData.branch_id ? 'border-amber-400' : ''}`}
                  disabled={selectedRoleIsCentral}
                >
                  <option value="">{selectedRoleIsCentral ? 'N/A - Central Role' : 'All Branches'}</option>
                  {branches.filter(b => b.status !== 'inactive').map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
                {selectedRoleRequiresBranch && !formData.branch_id && (
                  <p className="text-amber-500 text-xs mt-1">This role typically requires a branch assignment</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="+254 7XX XXX XXX"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-blue-600">POS PIN (Waiters: RXXX, Bar: BXXX)</label>
                <Input
                  value={formData.pos_pin}
                  onChange={(e) => setFormData({ ...formData, pos_pin: e.target.value.toUpperCase() })}
                  placeholder="e.g. R123"
                  maxLength={4}
                  className={formErrors.pos_pin ? 'border-red-500' : ''}
                />
                {formErrors.pos_pin && <p className="text-red-500 text-xs mt-1">{formErrors.pos_pin}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <IOSButton variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1" disabled={isSubmitting}>Cancel</IOSButton>
                <IOSButton onClick={handleUpdateUser} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update User'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
            <div className="py-4">
              <p className="text-gray-700">Are you sure you want to delete this user? This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="secondary" onClick={() => setConfirmDeleteOpen(false)} className="flex-1" disabled={isSubmitting}>Cancel</IOSButton>
              <IOSButton onClick={handleConfirmDelete} className="flex-1 bg-red-500 hover:bg-red-600" disabled={isSubmitting}>
                {isSubmitting ? 'Deleting...' : 'Delete User'}
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
