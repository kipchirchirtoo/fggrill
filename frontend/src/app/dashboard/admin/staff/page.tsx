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
import { WizardStepIndicator } from '@/components/ui/wizard-step-indicator';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [departments] = useState([
    { id: 'housekeeping', name: 'Housekeeping' },
    { id: 'restaurant', name: 'Restaurant' },
    { id: 'reception', name: 'Reception' },
    { id: 'maintenance', name: 'Maintenance' },
    { id: 'finance', name: 'Finance' },
    { id: 'management', name: 'Management' },
    { id: 'security', name: 'Security' },
    { id: 'bar_lounge', name: 'Bar & Lounge' },
    { id: 'administration', name: 'Administration' },
    { id: 'driver', name: 'Driver / Transport' },
    { id: 'logistics', name: 'Logistics' },
    { id: 'stores', name: 'Stores / Storekeeper' },
    { id: 'laundry', name: 'Laundry' },
    { id: 'it', name: 'IT' },
    { id: 'general', name: 'General' },
  ]);
  const [formData, setFormData] = useState({
    id: '',
    first_name: '',
    last_name: '',
    email: '',
    national_id: '',
    position: '',
    branch_id: '',
    department: '',
    phone: '',
    status: 'active'
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [wizardStep, setWizardStep] = useState(1);

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffRes, branchesRes] = await Promise.all([
        staffAPI.getStaff(),
        systemAPI.getBranches(),
      ]);

      if (staffRes.success) setStaff(staffRes.data || []);
      if (branchesRes.success) setBranches(branchesRes.data || []);
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
      national_id: '',
      position: '',
      branch_id: '',
      department: '',
      phone: '',
      status: 'active'
    });
    setFormErrors({});
    setWizardStep(1);
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!formData.first_name) errors.first_name = 'First name is required';
    if (!formData.last_name) errors.last_name = 'Last name is required';
    if (!formData.national_id) errors.national_id = 'National ID is required';
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
      national_id: (member as any).national_id || '',
      position: (member as any).position || member.role || '',
      branch_id: member.branch_id?.toString() || '',
      department: member.department || '',
      phone: member.phone || '',
      status: member.status
    });
    setEditModalOpen(true);
    setWizardStep(1);
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
        <div className="space-y-8 animate-ios-fade-in">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold text-stone-900 tracking-tight font-sf-pro-display">Personnel Registry</h1>
              <p className="text-stone-500">Manage employee records, job roles, and department assignments</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchStaff}
                disabled={isLoading}
                className="px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
              <Link href="/dashboard/admin/staff/attendance">
                <button className="px-4 py-2 rounded-full bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 transition-all flex items-center gap-2 active:scale-95">
                  <Calendar className="h-4 w-4" />
                  <span>Attendance</span>
                </button>
              </Link>
              <button
                onClick={() => setAddModalOpen(true)}
                className="px-5 py-2 rounded-full bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-all flex items-center gap-2 shadow-sm active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Add Member</span>
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card border-l-4 border-l-blue-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="stat-label uppercase tracking-widest text-[10px]">Total Strength</p>
                  <p className="stat-value text-2xl">{stats.total}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-400" />
                </div>
              </div>
            </div>
            <div className="stat-card border-l-4 border-l-emerald-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="stat-label uppercase tracking-widest text-[10px]">Active Personnel</p>
                  <p className="stat-value text-2xl text-emerald-600">{stats.active}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <User className="h-4 w-4 text-emerald-400" />
                </div>
              </div>
            </div>
            <div className="stat-card border-l-4 border-l-stone-300">
              <div className="flex justify-between items-start">
                <div>
                  <p className="stat-label uppercase tracking-widest text-[10px]">Inactive / On Leave</p>
                  <p className="stat-value text-2xl text-stone-400">{stats.inactive}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center">
                  <User className="h-4 w-4 text-stone-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="card-elevated p-4 border border-stone-100">
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
          </div>

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
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogTitle className="text-xl font-semibold border-b pb-4">Add Staff Member</DialogTitle>

            <div className="flex-1 overflow-y-auto px-1">
              {/* Wizard Step Indicator */}
              <WizardStepIndicator
                steps={[
                  { id: 1, title: 'Personal Info', description: 'Name & contact' },
                  { id: 2, title: 'Department & Role', description: 'Work assignment' },
                  { id: 3, title: 'Review', description: 'Confirm details' },
                ]}
                currentStep={wizardStep - 1}
                onStepClick={(index) => setWizardStep(index + 1)}
                allowClickNavigation={true}
              />

              <AnimatePresence mode="wait">
                {wizardStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4 mt-6"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">First Name <span className="text-red-500">*</span></label>
                        <Input
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          className={formErrors.first_name ? 'border-red-500' : ''}
                          placeholder="Enter first name"
                        />
                        {formErrors.first_name && <p className="text-red-500 text-xs mt-1">{formErrors.first_name}</p>}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Last Name <span className="text-red-500">*</span></label>
                        <Input
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          className={formErrors.last_name ? 'border-red-500' : ''}
                          placeholder="Enter last name"
                        />
                        {formErrors.last_name && <p className="text-red-500 text-xs mt-1">{formErrors.last_name}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">National ID <span className="text-red-500">*</span></label>
                      <Input
                        value={formData.national_id}
                        onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                        className={formErrors.national_id ? 'border-red-500' : ''}
                        placeholder="Enter National ID number"
                      />
                      {formErrors.national_id && <p className="text-red-500 text-xs mt-1">{formErrors.national_id}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+254 7XX XXX XXX"
                      />
                    </div>
                  </motion.div>
                )}

                {wizardStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4 mt-6"
                  >
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Department <span className="text-red-500">*</span></label>
                      <select
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className={`w-full p-2 border rounded-lg ${formErrors.department ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      >
                        <option value="">Select department</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      {formErrors.department && <p className="text-red-500 text-xs mt-1">{formErrors.department}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Role / Position</label>
                      <Input
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        placeholder="e.g. Head Chef, Manager, Admin"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Branch</label>
                      <select
                        value={formData.branch_id}
                        onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select branch</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  </motion.div>
                )}

                {wizardStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="py-4"
                  >
                    <div className="border rounded-lg p-6">
                      <h3 className="font-semibold text-lg text-gray-800 mb-4">Review Staff Details</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600">Name:</span>
                          <span className="font-medium text-gray-900">{formData.first_name} {formData.last_name}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600">National ID:</span>
                          <span className="font-medium text-gray-900">{formData.national_id}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-gray-600">Department:</span>
                          <span className="font-medium text-gray-900">{departments.find(d => d.id === formData.department)?.name || formData.department}</span>
                        </div>
                        {formData.position && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-gray-600">Role / Position:</span>
                            <span className="font-medium text-gray-900">{formData.position}</span>
                          </div>
                        )}
                        {formData.branch_id && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-gray-600">Branch:</span>
                            <span className="font-medium text-gray-900">{branches.find(b => b.id.toString() === formData.branch_id)?.name}</span>
                          </div>
                        )}
                        {formData.email && (
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-medium text-gray-900">{formData.email}</span>
                          </div>
                        )}
                        {formData.phone && (
                          <div className="flex justify-between py-2">
                            <span className="text-gray-600">Phone:</span>
                            <span className="font-medium text-gray-900">{formData.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* Sticky Footer with Navigation */}
            <div className="border-t bg-white p-4 flex gap-3 sticky bottom-0">
              {wizardStep > 1 && (
                <IOSButton
                  variant="secondary"
                  onClick={() => setWizardStep(prev => prev - 1)}
                  className="flex-1"
                >
                  Previous
                </IOSButton>
              )}

              {wizardStep < 3 ? (
                <IOSButton
                  onClick={() => {
                    if (wizardStep === 1) {
                      const errors: any = {};
                      if (!formData.first_name) errors.first_name = 'First name is required';
                      if (!formData.last_name) errors.last_name = 'Last name is required';
                      if (!formData.national_id) errors.national_id = 'National ID is required';
                      if (Object.keys(errors).length > 0) {
                        setFormErrors(errors);
                        toast.error('Please fill in required fields');
                        return;
                      }
                    }
                    if (wizardStep === 2) {
                      const errors: any = {};
                      if (!formData.department) errors.department = 'Department is required';
                      if (Object.keys(errors).length > 0) {
                        setFormErrors(errors);
                        toast.error('Please fill in required fields');
                        return;
                      }
                    }
                    setFormErrors({});
                    setWizardStep(prev => prev + 1);
                  }}
                  className="flex-1"
                >
                  Next
                </IOSButton>
              ) : (
                <IOSButton
                  onClick={handleCreateStaff}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Staff Member'}
                </IOSButton>
              )}
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
                <label className="text-sm font-medium">National ID <span className="text-red-500">*</span></label>
                <Input
                  value={formData.national_id}
                  onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  className={formErrors.national_id ? 'border-red-500' : ''}
                  placeholder="Enter National ID"
                />
                {formErrors.national_id && <p className="text-red-500 text-xs mt-1">{formErrors.national_id}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Department <span className="text-red-500">*</span></label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className={`w-full p-2 border rounded-ios-lg ${formErrors.department ? 'border-red-500' : ''}`}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {formErrors.department && <p className="text-red-500 text-xs mt-1">{formErrors.department}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Role / Position</label>
                <Input
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="e.g. Head Chef, Manager"
                />
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
