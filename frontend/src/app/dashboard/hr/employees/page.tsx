'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { staffAPI, systemAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Users, RefreshCw, Plus, Search, User, Building2, Edit2, Trash2, Mail, Phone } from 'lucide-react';
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
    national_id?: string;
    status: 'active' | 'inactive';
}

export default function HREmployeesPage() {
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
        national_id: '',
        status: 'active'
    });
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);
    const [departmentFilter, setDepartmentFilter] = useState('');

    const fetchStaffData = useCallback(async () => {
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
        } catch (error) {
            console.error('Error fetching staff data:', error);
            toast.error('Failed to load employees');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStaffData();
    }, [fetchStaffData]);

    const filteredStaff = staff.filter((s) => {
        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
        const matchesSearch =
            fullName.includes(searchQuery.toLowerCase()) ||
            s.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDepartment = departmentFilter ? s.department === departmentFilter : true;

        return matchesSearch && matchesDepartment;
    });

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
            national_id: '',
            status: 'active'
        });
        setFormErrors({});
    };

    const validateForm = () => {
        const errors: { [key: string]: string } = {};
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
            toast.success('Employee onboarded successfully');
            setAddModalOpen(false);
            resetForm();
            fetchStaffData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to onboard employee');
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
            national_id: member.national_id || '',
            status: member.status
        });
        setEditModalOpen(true);
    };

    const handleUpdateStaff = async () => {
        if (!validateForm()) return;
        setIsSubmitting(true);
        try {
            await staffAPI.updateStaffMember(formData.id, formData);
            toast.success('Employee profile updated');
            setEditModalOpen(false);
            resetForm();
            fetchStaffData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update profile');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = (member: Staff) => {
        setFormData({ ...formData, id: member.id });
        setConfirmDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        setIsSubmitting(true);
        try {
            await staffAPI.deleteStaffMember(formData.id);
            toast.success('Employee record removed');
            setConfirmDeleteOpen(false);
            resetForm();
            fetchStaffData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove employee');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Employees</h1>
                            <p className="text-stone-500 mt-0.5">Manage staff profiles and directory</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchStaffData} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                                Refresh
                            </IOSButton>
                            <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>
                                Onboard New Staff
                            </IOSButton>
                        </div>
                    </div>

                    {/* Filters */}
                    <IOSCard className="p-4">
                        <div className="grid md:grid-cols-4 gap-4">
                            <div className="md:col-span-2 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <Input
                                    placeholder="Search by name, email, or role..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 h-11 bg-stone-50 border-stone-100"
                                />
                            </div>
                            <div className="col-span-1">
                                <select
                                    value={departmentFilter}
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                    className="w-full h-11 px-3 bg-stone-50 border border-stone-100 rounded-ios-lg text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-200"
                                >
                                    <option value="">All Departments</option>
                                    {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center justify-center bg-stone-50 rounded-ios-lg px-4 border border-stone-100 h-11">
                                <Users className="h-4 w-4 text-stone-400 mr-2" />
                                <span className="text-sm font-medium text-stone-600">{filteredStaff.length} Employees</span>
                            </div>
                        </div>
                    </IOSCard>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <RefreshCw className="h-8 w-8 animate-spin text-stone-300" />
                        </div>
                    ) : filteredStaff.length === 0 ? (
                        <IOSCard className="p-20 text-center">
                            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-stone-100">
                                <Users className="h-8 w-8 text-stone-300" />
                            </div>
                            <h3 className="text-lg font-medium text-stone-900">No employees found</h3>
                            <p className="text-stone-500 mt-1">Try adjusting your search or filters</p>
                        </IOSCard>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredStaff.map((member) => (
                                <IOSCard key={member.id} className="p-5 hover:shadow-md transition-shadow group h-full flex flex-col">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center text-stone-600 font-bold text-lg border border-stone-100">
                                            {member.first_name?.[0]}{member.last_name?.[0]}
                                        </div>
                                        <IOSBadge variant={member.status === 'active' ? 'pill' : 'outline'}>
                                            {member.status}
                                        </IOSBadge>
                                    </div>

                                    <div className="flex-1">
                                        <h3 className="font-bold text-stone-900 leading-tight">{member.first_name} {member.last_name}</h3>
                                        <p className="text-stone-500 text-xs font-medium uppercase tracking-wider mt-1">{member.role}</p>

                                        <div className="mt-4 space-y-2">
                                            <div className="flex items-center gap-2 text-[13px] text-stone-600">
                                                <Building2 className="h-3.5 w-3.5 text-stone-400" />
                                                <span>{member.department || member.branch_name || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[13px] text-stone-600">
                                                <Mail className="h-3.5 w-3.5 text-stone-400" />
                                                <span className="truncate">{member.email}</span>
                                            </div>
                                            {member.phone && (
                                                <div className="flex items-center gap-2 text-[13px] text-stone-600">
                                                    <Phone className="h-3.5 w-3.5 text-stone-400" />
                                                    <span>{member.phone}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-6 pt-4 border-t border-stone-50">
                                        <IOSButton
                                            size="sm"
                                            variant="secondary"
                                            className="flex-1 h-9 rounded-ios-md"
                                            onClick={() => handleEditStaff(member)}
                                            leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                                        >
                                            Edit
                                        </IOSButton>
                                        <IOSButton
                                            size="sm"
                                            variant="secondary"
                                            className="h-9 w-9 p-0 rounded-ios-md text-red-500 hover:bg-red-50"
                                            onClick={() => handleDeleteClick(member)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </IOSButton>
                                    </div>
                                </IOSCard>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add/Edit Modal */}
                <Dialog open={addModalOpen || editModalOpen} onOpenChange={(open) => {
                    if (!open) {
                        setAddModalOpen(false);
                        setEditModalOpen(false);
                        resetForm();
                    }
                }}>
                    <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-ios-2xl border-none shadow-2xl">
                        <div className="p-6">
                            <DialogHeader className="mb-6">
                                <DialogTitle className="text-xl font-bold text-stone-900">
                                    {addModalOpen ? 'Onboard New Staff' : 'Edit Employee Profile'}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 block">First Name</label>
                                        <Input
                                            value={formData.first_name}
                                            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                            className={`h-11 bg-stone-50 border-stone-100 ${formErrors.first_name ? 'border-red-300' : ''}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 block">Last Name</label>
                                        <Input
                                            value={formData.last_name}
                                            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                            className={`h-11 bg-stone-50 border-stone-100 ${formErrors.last_name ? 'border-red-300' : ''}`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 block">Email Address</label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className={`h-11 bg-stone-50 border-stone-100 ${formErrors.email ? 'border-red-300' : ''}`}
                                    />
                                </div>

                                <div>
                                    <label className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 block">Phone Number</label>
                                    <Input
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="h-11 bg-stone-50 border-stone-100"
                                    />
                                </div>

                                <div>
                                    <label className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 block">National ID (Official)</label>
                                    <Input
                                        value={formData.national_id}
                                        onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                                        placeholder="e.g. 12345678"
                                        className="h-11 bg-stone-50 border-stone-100"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 block">Role</label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className={`w-full h-11 px-3 bg-stone-50 border border-stone-100 rounded-ios-lg text-sm ${formErrors.role ? 'border-red-300' : ''}`}
                                        >
                                            <option value="">Select role</option>
                                            {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 block">Department</label>
                                        <select
                                            value={formData.department}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                            className={`w-full h-11 px-3 bg-stone-50 border border-stone-100 rounded-ios-lg text-sm ${formErrors.department ? 'border-red-300' : ''}`}
                                        >
                                            <option value="">Select department</option>
                                            {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 block">Branch</label>
                                        <select
                                            value={formData.branch_id}
                                            onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                            className="w-full h-11 px-3 bg-stone-50 border border-stone-100 rounded-ios-lg text-sm"
                                        >
                                            <option value="">Select branch</option>
                                            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 block">Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                                            className="w-full h-11 px-3 bg-stone-50 border border-stone-100 rounded-ios-lg text-sm"
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <IOSButton
                                    variant="secondary"
                                    onClick={() => {
                                        setAddModalOpen(false);
                                        setEditModalOpen(false);
                                        resetForm();
                                    }}
                                    className="flex-1 h-11"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </IOSButton>
                                <IOSButton
                                    onClick={addModalOpen ? handleCreateStaff : handleUpdateStaff}
                                    className="flex-1 h-11"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Processing...' : (addModalOpen ? 'Complete Onboarding' : 'Save Changes')}
                                </IOSButton>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation */}
                <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                    <DialogContent className="max-w-[320px] bg-white p-6 rounded-ios-2xl border-none shadow-2xl">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="h-6 w-6 text-red-500" />
                            </div>
                            <h3 className="text-lg font-bold text-stone-900">Remove Employee?</h3>
                            <p className="text-stone-500 text-sm mt-2 font-medium">This will permanently remove the record from the system.</p>
                        </div>
                        <div className="flex flex-col gap-2 mt-6">
                            <IOSButton
                                onClick={handleConfirmDelete}
                                className="w-full bg-red-500 hover:bg-red-600 text-white border-none h-11"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Removing...' : 'Remove Record'}
                            </IOSButton>
                            <IOSButton
                                variant="secondary"
                                onClick={() => setConfirmDeleteOpen(false)}
                                className="w-full h-11"
                                disabled={isSubmitting}
                            >
                                Keep Record
                            </IOSButton>
                        </div>
                    </DialogContent>
                </Dialog>

            </DashboardLayout>
        </ProtectedRoute>
    );
}
