'use client';

import { useState, useEffect, useCallback } from 'react';
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
  status: 'active' | 'inactive'; 
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [roles, setRoles] = useState<{id: string, name: string}[]>([]);
  const [branches, setBranches] = useState<{id: number, name: string, code: string}[]>([]);
  const [formData, setFormData] = useState({ id: '', email: '', first_name: '', last_name: '', role: '', branch_id: '', password: '', status: 'active' });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [roleFilter, setRoleFilter] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes, branchesRes] = await Promise.all([
        userAPI.getUsers(),
        systemAPI.getRoles(),
        systemAPI.getBranches(),
      ]);
      if (usersRes.success) setUsers(usersRes.data || []);
      if (rolesRes.success) setRoles(rolesRes.data || []);
      if (branchesRes.success) setBranches(branchesRes.data || []);
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
    const errors: {[key: string]: string} = {};
    
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Email is invalid';
    
    if (!formData.first_name) errors.first_name = 'First name is required';
    if (!formData.role) errors.role = 'Role is required';
    
    if (!formData.id && !formData.password) errors.password = 'Password is required';
    else if (!formData.id && formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({ id: '', email: '', first_name: '', last_name: '', role: '', branch_id: '', password: '', status: 'active' });
    setFormErrors({});
  };

  const handleEditUser = (user: UserData) => {
    setFormData({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name || '',
      role: user.role,
      branch_id: user.branch_id || '',
      password: '',
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
      await userAPI.createUser(formData);
      toast.success('User created successfully');
      setAddModalOpen(false);
      resetForm();
      fetchUsers();
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
      // Don't send password if it's empty (no change)
      const updateData = { ...formData };
      if (!updateData.password) delete updateData.password;
      
      await userAPI.updateUser(formData.id, updateData);
      toast.success('User updated successfully');
      setEditModalOpen(false);
      resetForm();
      fetchUsers();
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search users by name or email..." 
                  value={searchQuery} 
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to first page on search
                  }} 
                  className="pl-10" 
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
                  {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
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
                      <td className="p-3"><IOSBadge variant="light" color="info">{u.role}</IOSBadge></td>
                      <td className="p-3 text-gray-500">{u.branch_name || 'All'}</td>
                      <td className="p-3 text-center"><IOSBadge variant={u.status === 'active' ? 'success' : 'neutral'}>{u.status}</IOSBadge></td>
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
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })} 
                  className={`w-full p-2 border rounded-ios-lg ${formErrors.role ? 'border-red-500' : ''}`}
                >
                  <option value="">Select role</option>
                  {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
                {formErrors.role && <p className="text-red-500 text-xs mt-1">{formErrors.role}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Branch</label>
                <select 
                  value={formData.branch_id} 
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })} 
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
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
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })} 
                  className={`w-full p-2 border rounded-ios-lg ${formErrors.role ? 'border-red-500' : ''}`}
                >
                  <option value="">Select role</option>
                  {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
                {formErrors.role && <p className="text-red-500 text-xs mt-1">{formErrors.role}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Branch</label>
                <select 
                  value={formData.branch_id} 
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })} 
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
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
