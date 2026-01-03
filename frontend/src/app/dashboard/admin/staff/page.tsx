'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { staffAPI, systemAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Users, RefreshCw, Plus, Search, User, Building2, Calendar, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Staff { 
  id: string; 
  first_name: string; 
  last_name: string; 
  email: string; 
  role: string; 
  branch_id?: string;
  branch_name?: string; 
  department?: string; 
  phone?: string;
  status: 'active' | 'inactive'; 
}

export default function AdminStaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    id: '',
    first_name: '',
    last_name: '',
    email: '',
    role: '',
    branch_id: '',
    department: '',
    phone: '',
    status: 'active'
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [departmentFilter, setDepartmentFilter] = useState('');

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffRes, branchesRes, departmentsRes, rolesRes] = await Promise.all([
        staffAPI.getStaff(),
        systemAPI.getBranches(),
        systemAPI.getDepartments(),
        staffAPI.getRoles(),
      ]);
      
      if (staffRes.success) setStaff(staffRes.data || []);
      if (branchesRes.success) setBranches(branchesRes.data || []);
      if (departmentsRes.success) setDepartments(departmentsRes.data || []);
      if (rolesRes.success) setRoles(rolesRes.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const filteredStaff = staff.filter((s) => {
    const matchesSearch = 
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = departmentFilter ? s.department === departmentFilter : true;
    
    return matchesSearch && matchesDepartment;
  });

  const stats = { 
    total: staff.length, 
    active: staff.filter(s => s.status === 'active').length,
    inactive: staff.filter(s => s.status === 'inactive').length,
  };

  const resetForm = () => {
    setFormData({
      id: '',
      first_name: '',
      last_name: '',
      email: '',
      role: '',
      branch_id: '',
      department: '',
      phone: '',
      status: 'active'
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.first_name) errors.first_name = 'First name is required';
    if (!formData.last_name) errors.last_name = 'Last name is required';
    
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Email is invalid';
    
    if (!formData.role) errors.role = 'Role is required';
    if (!formData.department) errors.department = 'Department is required';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateStaff = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await staffAPI.createStaffMember(formData);
      toast.success('Staff member created successfully');
      setAddModalOpen(false);
      resetForm();
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStaff = (member: Staff) => {
    setFormData({
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      role: member.role,
      branch_id: member.branch_id?.toString() || '',
      department: member.department || '',
      phone: member.phone || '',
      status: member.status
    });
    setEditModalOpen(true);
  };

  const handleUpdateStaff = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {      
      await staffAPI.updateStaffMember(formData.id, formData);
      toast.success('Staff member updated successfully');
      setEditModalOpen(false);
      resetForm();
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = (member: Staff) => {
    setFormData({ ...formData, id: member.id });
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsSubmitting(true);
    try {
      await staffAPI.deleteStaffMember(formData.id);
      toast.success('Staff member deleted successfully');
      setConfirmDeleteOpen(false);
      resetForm();
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Staff</h1><p className="text-gray-500">Manage employees</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchStaff} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <Link href="/dashboard/admin/staff/attendance"><IOSButton variant="secondary" leftIcon={<Calendar />}>Attendance</IOSButton></Link>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Staff</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Users className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Staff</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4"><User className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Active</p><p className="text-xl font-bold text-[#34C759]">{stats.active}</p></IOSCard>
            <IOSCard className="p-4"><User className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Inactive</p><p className="text-xl font-bold text-[#FF3B30]">{stats.inactive}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input 
                  placeholder="Search staff by name or email..." 
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
                  value={departmentFilter}
                  onChange={(e) => {
                    setDepartmentFilter(e.target.value);
                    setCurrentPage(1); // Reset to first page on filter change
                  }}
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredStaff.length === 0 ? (
            <IOSCard className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No staff members found</p></IOSCard>
          ) : (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStaff
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((member) => (
                  <IOSCard key={member.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">{member.first_name} {member.last_name}</p>
                        <p className="text-sm text-gray-500">{member.role}</p>
                        <p className="text-xs text-gray-400 mb-1">{member.department || 'No Department'}</p>
                        {member.branch_name && <p className="text-xs text-gray-400 flex items-center gap-1 mb-2"><Building2 className="h-3 w-3" /> {member.branch_name}</p>}
                        <div className="flex items-center justify-between mt-2">
                          <IOSBadge className={member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{member.status}</IOSBadge>
                          <div className="flex gap-1">
                            <IOSButton 
                              size="xs" 
                              variant="ghost" 
                              onClick={() => handleEditStaff(member)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton 
                              size="xs" 
                              variant="ghost" 
                              className="text-red-500 hover:bg-red-50"
                              onClick={() => handleDeleteStaff(member)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IOSButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  </IOSCard>
                ))}
              </div>
              
              {/* Pagination */}
              {filteredStaff.length > itemsPerPage && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    Showing {Math.min(filteredStaff.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredStaff.length, currentPage * itemsPerPage)} of {filteredStaff.length} staff members
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
                    
                    {Array.from({ length: Math.ceil(filteredStaff.length / itemsPerPage) }).map((_, idx) => (
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
                      Math.min(Math.ceil(filteredStaff.length / itemsPerPage), currentPage + 2)
                    )}
                    
                    <IOSButton 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredStaff.length / itemsPerPage), prev + 1))}
                      disabled={currentPage === Math.ceil(filteredStaff.length / itemsPerPage)}
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

        {/* Add Staff Modal */}
        <Dialog open={addModalOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setAddModalOpen(open);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
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
                  <label className="text-sm font-medium">Last Name <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.last_name} 
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} 
                    className={formErrors.last_name ? 'border-red-500' : ''}
                  />
                  {formErrors.last_name && <p className="text-red-500 text-xs mt-1">{formErrors.last_name}</p>}
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
                <label className="text-sm font-medium">Phone</label>
                <Input 
                  value={formData.phone} 
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                />
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
                <label className="text-sm font-medium">Department <span className="text-red-500">*</span></label>
                <select 
                  value={formData.department} 
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })} 
                  className={`w-full p-2 border rounded-ios-lg ${formErrors.department ? 'border-red-500' : ''}`}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
                {formErrors.department && <p className="text-red-500 text-xs mt-1">{formErrors.department}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Branch</label>
                <select 
                  value={formData.branch_id} 
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })} 
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="">Select branch</option>
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
                <IOSButton onClick={handleCreateStaff} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Staff'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Staff Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setEditModalOpen(open);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Staff Member</DialogTitle></DialogHeader>
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
                  <label className="text-sm font-medium">Last Name <span className="text-red-500">*</span></label>
                  <Input 
                    value={formData.last_name} 
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} 
                    className={formErrors.last_name ? 'border-red-500' : ''}
                  />
                  {formErrors.last_name && <p className="text-red-500 text-xs mt-1">{formErrors.last_name}</p>}
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
                <label className="text-sm font-medium">Phone</label>
                <Input 
                  value={formData.phone} 
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                />
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
                <label className="text-sm font-medium">Department <span className="text-red-500">*</span></label>
                <select 
                  value={formData.department} 
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })} 
                  className={`w-full p-2 border rounded-ios-lg ${formErrors.department ? 'border-red-500' : ''}`}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
                {formErrors.department && <p className="text-red-500 text-xs mt-1">{formErrors.department}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Branch</label>
                <select 
                  value={formData.branch_id} 
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })} 
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="">Select branch</option>
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
                <IOSButton onClick={handleUpdateStaff} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update Staff'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Staff Member</DialogTitle></DialogHeader>
            <div className="py-4">
              <p className="text-gray-700">Are you sure you want to delete this staff member? This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="secondary" onClick={() => setConfirmDeleteOpen(false)} className="flex-1" disabled={isSubmitting}>Cancel</IOSButton>
              <IOSButton onClick={handleConfirmDelete} className="flex-1 bg-red-500 hover:bg-red-600" disabled={isSubmitting}>
                {isSubmitting ? 'Deleting...' : 'Delete Staff'}
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>
        
      </DashboardLayout>
    </ProtectedRoute>
  );
}
