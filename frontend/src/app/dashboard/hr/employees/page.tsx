'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { staffAPI, systemAPI, storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Users, RefreshCw, Plus, Search, User, Building2, Edit2, Trash2, Mail, Phone, FileText, History, UserPlus, Archive, ArrowLeft, Download } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { downloadEmployeePDF } from '@/lib/employee-pdf';

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
    nssf_enabled?: boolean;
    shif_enabled?: boolean;
    housing_fund_enabled?: boolean;
}

export default function HREmployeesPage() {
    const { user } = useAuth();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        id: '',
        first_name: '',
        last_name: '',
        email: '',
        national_id: '',
        department: '',
        position: '',
        branch_id: '',
        phone_number: '',
        pos_pin: '',
        shift: 'morning',
        address: '',
        ec_name: '',
        ec_phone: '',
        ec_relationship: '',
        supervisor_id: '',
        basic_salary: 0,
        status: 'active',
        archive_notes: '',
        nssf_enabled: true,
        shif_enabled: true,
        housing_fund_enabled: true
    });
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [wizardStep, setWizardStep] = useState(1);

    const fetchStaffData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [staffRes, branchesRes, departmentsRes, rolesRes, driversRes, usersRes] = await Promise.all([
                staffAPI.getStaff(),
                systemAPI.getBranches(),
                systemAPI.getDepartments(),
                staffAPI.getRoles(),
                storeAPI.getDrivers(),
                typeof systemAPI.getSystemUsers === 'function' ? systemAPI.getSystemUsers() : Promise.resolve({ data: [] }),
            ]);

            // Map drivers from Central Store into the Staff shape
            const rawDrivers: any[] = driversRes?.data || [];
            const rawUsers: any[] = usersRes?.data || [];
            const regularStaff: Staff[] = staffRes.success ? (staffRes.data || []) : [];

            // Build a deduplication lookup set from existing staff_profiles
            // Keys: lowercased email (if available) OR "firstname|lastname|phone"
            const staffKeys = new Set<string>();
            for (const s of regularStaff) {
                if (s.email) staffKeys.add(s.email.toLowerCase().trim());
                if (s.phone) staffKeys.add(`${s.first_name}|${s.last_name}|${s.phone}`.toLowerCase().trim());
            }

            // Extract users missing from staff_profiles (Waiters, Cashiers, Kitchen, etc)
            const missingUsers: Staff[] = rawUsers
                .filter((u: any) => {
                    // Only include users who aren't drivers (already handled) without full profiles
                    if (u.role === 'driver' || u.role === 'guest') return false;

                    const emailKey = (u.email || '').toLowerCase().trim();
                    const namePhoneKey = `${u.first_name || ''}|${u.last_name || ''}|${(u.phone_number || '')}`.toLowerCase().trim();

                    return (
                        (!emailKey || !staffKeys.has(emailKey)) &&
                        !staffKeys.has(namePhoneKey)
                    );
                })
                .map((u: any) => {
                    return {
                        id: u.id,
                        first_name: u.first_name || '',
                        last_name: u.last_name || '',
                        email: u.email || '',
                        role: u.role || 'user',
                        branch_id: u.branch_id ? String(u.branch_id) : undefined,
                        department: u.role === 'restaurant' || u.role === 'pos_kitchen' ? 'Service/F&B' : 'Operations',
                        phone: u.phone_number || '',
                        national_id: '',
                        status: (u.status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
                        ...(u as any)
                    } as Staff;
                });

            // Update staffKeys with the missing users to prevent drivers from colliding
            for (const u of missingUsers) {
                if (u.email) staffKeys.add(u.email.toLowerCase().trim());
                if (u.phone) staffKeys.add(`${u.first_name}|${u.last_name}|${u.phone}`.toLowerCase().trim());
            }

            // Only include drivers NOT already present in staffKeys
            const driverStaff: Staff[] = rawDrivers
                .filter((d: any) => {
                    const emailKey = (d.email || '').toLowerCase().trim();
                    const nameParts = (d.name || '').trim().split(' ');
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ');
                    const namePhoneKey = `${firstName}|${lastName}|${(d.phone || '')}`.toLowerCase().trim();

                    return (
                        (!emailKey || !staffKeys.has(emailKey)) &&
                        !staffKeys.has(namePhoneKey)
                    );
                })
                .map((d: any) => {
                    const nameParts = (d.name || '').trim().split(' ');
                    return {
                        id: d.id,
                        first_name: nameParts[0] || d.name,
                        last_name: nameParts.slice(1).join(' ') || '',
                        email: d.email || '',
                        role: 'driver',
                        branch_id: d.branch_id ? String(d.branch_id) : undefined,
                        department: 'Logistics',
                        phone: d.phone || '',
                        national_id: d.license_number || '',
                        status: (d.status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
                        ...(d as any)
                    } as Staff;
                });

            setStaff([...regularStaff, ...missingUsers, ...driverStaff]);

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
            national_id: '',
            department: '',
            position: '',
            branch_id: '',
            phone_number: '',
            pos_pin: '',
            shift: 'morning',
            address: '',
            ec_name: '',
            ec_phone: '',
            ec_relationship: '',
            supervisor_id: '',
            basic_salary: 0,
            status: 'active',
            archive_notes: '',
            nssf_enabled: true,
            shif_enabled: true,
            housing_fund_enabled: true
        });
        setWizardStep(1);
        setFormErrors({});
    };

    const validateForm = () => {
        const errors: { [key: string]: string } = {};
        if (!formData.first_name) errors.first_name = 'First name is required';
        if (!formData.last_name) errors.last_name = 'Last name is required';
        if (!formData.national_id) errors.national_id = 'National ID is required';
        if (!formData.department) errors.department = 'Department is required';
        if (!formData.basic_salary || formData.basic_salary <= 0) errors.basic_salary = 'Salary is mandatory';

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateStaff = async () => {
        if (!validateForm()) return;
        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                emergency_contact: {
                    name: formData.ec_name,
                    phone: formData.ec_phone,
                    relationship: formData.ec_relationship
                }
            };
            await staffAPI.createStaffMember(payload);
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
            national_id: member.national_id || '',
            department: member.department || '',
            position: (member as any).position || member.role || '',
            branch_id: member.branch_id?.toString() || '',
            phone_number: member.phone || (member as any).phone_number || '',
            status: member.status,
            pos_pin: (member as any).pos_pin || '',
            shift: (member as any).shift || 'morning',
            address: (member as any).address || '',
            ec_name: (member as any).emergency_contact?.name || (member as any).ec_name || '',
            ec_phone: (member as any).emergency_contact?.phone || (member as any).ec_phone || '',
            ec_relationship: (member as any).emergency_contact?.relationship || (member as any).ec_relationship || '',
            supervisor_id: (member as any).supervisor_id || '',
            basic_salary: (member as any).basic_salary || 0,
            archive_notes: (member as any).archive_notes || '',
            nssf_enabled: member.nssf_enabled !== false,
            shif_enabled: member.shif_enabled !== false,
            housing_fund_enabled: member.housing_fund_enabled !== false
        });
        setEditModalOpen(true);
    };

    const handleViewDetails = async (member: Staff) => {
        setSelectedStaff(member);
        setDetailModalOpen(true);
        setIsLoading(true);
        try {
            const [histRes, docsRes] = await Promise.all([
                staffAPI.getStaffHistory(member.id),
                staffAPI.getStaffDocuments(member.id)
            ]);
            if (histRes.success) setHistory(histRes.data);
            if (docsRes.success) setDocuments(docsRes.data);
        } catch (error) {
            toast.error('Failed to load profile details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleArchiveStaff = (member: Staff) => {
        setFormData({ ...formData, id: member.id, archive_notes: '' });
        setConfirmArchiveOpen(true);
    };

    const handleConfirmArchive = async () => {
        setIsSubmitting(true);
        try {
            await staffAPI.archiveStaff(formData.id, formData.archive_notes);
            toast.success('Employee archived/terminated');
            setConfirmArchiveOpen(false);
            resetForm();
            fetchStaffData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to archive employee');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
        const file = e.target.files?.[0];
        if (!file || !selectedStaff) return;

        const formData = new FormData();
        formData.append('document', file);
        formData.append('documentType', type);

        try {
            const res = await staffAPI.uploadStaffDocument(selectedStaff.id, formData);
            if (res.success) {
                toast.success(`${type} uploaded successfully`);
                // Refresh documents
                const docRes = await staffAPI.getStaffDocuments(selectedStaff.id);
                if (docRes.success) setDocuments(docRes.data);
            }
        } catch (error) {
            toast.error('Failed to upload document');
        }
    };

    const handleUpdateStaff = async () => {
        if (!validateForm()) return;
        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                emergency_contact: {
                    name: formData.ec_name,
                    phone: formData.ec_phone,
                    relationship: formData.ec_relationship
                }
            };
            await staffAPI.updateStaffMember(formData.id, payload);
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
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-8 animate-ios-fade-in">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div>
                            <button
                                onClick={() => window.location.href = '/dashboard/hr'}
                                className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 mb-3 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to HR</span>
                            </button>
                            <h1 className="text-[28px] font-bold text-stone-900 tracking-tight font-sf-pro-display">Personnel Registry</h1>
                            <p className="text-stone-500">Comprehensive directory of all system personnel</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchStaffData}
                                disabled={isLoading}
                                className="w-10 h-10 rounded-full bg-white border border-stone-200 text-stone-500 hover:bg-stone-50 transition-all flex items-center justify-center shadow-sm active:scale-95"
                                title="Sync Registry"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => {
                                    const branchMap = branches.reduce((acc: any, b: any) => ({ ...acc, [b.id]: b.name }), {});
                                    const departmentMap = departments.reduce((acc: any, d: any) => ({ ...acc, [d.name]: d.name }), {}); // Names are mostly used, mapping just in case
                                    downloadEmployeePDF(filteredStaff, { branchMap, departmentMap });
                                    toast.success('Downloading Employee Registry...');
                                }}
                                disabled={filteredStaff.length === 0}
                                className="px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-700 text-sm font-bold hover:bg-stone-50 transition-all flex items-center gap-2 shadow-sm active:scale-95"
                            >
                                <Download className="h-4 w-4" />
                                <span>Export PDF</span>
                            </button>
                            <button
                                onClick={() => setAddModalOpen(true)}
                                className="px-5 py-2.5 rounded-full bg-stone-900 text-white text-sm font-bold hover:bg-stone-800 transition-all flex items-center gap-2 shadow-md active:scale-95"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Onboard Personnel</span>
                            </button>
                        </div>
                    </div>

                    {/* Filters & Statistics */}
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-stone-50 p-2 rounded-2xl border border-stone-100">
                        <div className="relative w-full lg:w-[400px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                placeholder="Search by name, role or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-[14px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all placeholder:text-stone-400"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                            <select
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                className="flex-1 lg:flex-none px-4 py-3 bg-white border border-stone-200 rounded-xl text-[14px] text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900/5 appearance-none min-w-[180px]"
                            >
                                <option value="">All Departments</option>
                                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>

                            <div className="px-5 py-3 bg-stone-900 text-white rounded-xl text-[13px] font-bold shadow-sm whitespace-nowrap">
                                {filteredStaff.length} Total Personnel
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-stone-100 border-dashed">
                            <div className="flex flex-col items-center gap-3">
                                <RefreshCw className="h-8 w-8 animate-spin text-stone-200" />
                                <p className="text-stone-400 text-sm font-medium">Synchronizing personnel data...</p>
                            </div>
                        </div>
                    ) : filteredStaff.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-stone-100 border-dashed p-20 text-center">
                            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-stone-100">
                                <Users className="h-8 w-8 text-stone-200" />
                            </div>
                            <h3 className="text-lg font-bold text-stone-900">No personnel records identified</h3>
                            <p className="text-stone-500 mt-1 max-w-xs mx-auto">The current search parameters did not yield any results in the registry.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-stone-50/50 border-b border-stone-100">
                                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Personnel</th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">System Role</th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Department</th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Contact Info</th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Operations</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {filteredStaff.map((member) => (
                                            <tr key={member.id} className="hover:bg-stone-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 font-bold text-xs">
                                                            {member.first_name?.[0] || '?'}{member.last_name?.[0] || '?'}
                                                        </div>
                                                        <div>
                                                            <p className="text-[14px] font-bold text-stone-900 leading-none">{member.first_name} {member.last_name}</p>
                                                            <p className="text-[11px] text-stone-400 mt-1 font-medium select-all">{member.id.substring(0, 8)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[13px] font-semibold text-stone-700">{member.role}</span>
                                                        {member.role === 'driver' && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">Central Store</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5 text-[13px] text-stone-600 font-medium">
                                                        <Building2 className="h-3.5 w-3.5 text-stone-300" />
                                                        {member.department || 'General'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5 text-[12px] text-stone-500">
                                                            <Mail className="h-3 w-3 text-stone-300" />
                                                            {member.email}
                                                        </div>
                                                        {member.phone && (
                                                            <div className="flex items-center gap-1.5 text-[12px] text-stone-500">
                                                                <Phone className="h-3 w-3 text-stone-300" />
                                                                {member.phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${member.status === 'active'
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                        : 'bg-stone-100 text-stone-500 border border-stone-200'
                                                        }`}>
                                                        {member.status}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleViewDetails(member)}
                                                            className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-[#007AFF] transition-colors"
                                                            title="View Profile Details"
                                                        >
                                                            <User className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditStaff(member)}
                                                            className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-900 transition-colors"
                                                            title="Edit Profile"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleArchiveStaff(member)}
                                                            className="p-2 hover:bg-amber-50 rounded-lg text-stone-400 hover:text-amber-600 transition-colors"
                                                            title="Archive/Terminate"
                                                        >
                                                            <Archive className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(member)}
                                                            className="p-2 hover:bg-red-50 rounded-lg text-stone-400 hover:text-red-600 transition-colors"
                                                            title="Force Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
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
                    <DialogContent className="max-w-[480px] p-0 overflow-hidden border-none rounded-ios-2xl bg-[#F2F2F7]">
                        <div className="bg-[#F2F2F7] px-4 py-3 border-b flex items-center justify-between">
                            <button
                                onClick={() => {
                                    setAddModalOpen(false);
                                    setEditModalOpen(false);
                                    resetForm();
                                }}
                                className="text-[#007AFF] text-lg"
                            >
                                Cancel
                            </button>
                            <DialogTitle className="text-lg font-semibold">
                                {addModalOpen ? 'Onboard Staff' : 'Edit Profile'}
                            </DialogTitle>
                            <div className="w-12"></div>
                        </div>

                        <div className="p-4 bg-[#F2F2F7]">
                            {/* Step Indicator */}
                            <div className="flex justify-center gap-1 mb-6">
                                {[1, 2, 3, 4].map((step) => (
                                    <div
                                        key={step}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${wizardStep === step ? 'w-8 bg-[#007AFF]' : 'w-2 bg-gray-300'
                                            }`}
                                    />
                                ))}
                            </div>

                            <AnimatePresence mode="wait">
                                {wizardStep === 1 && (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100">
                                            <div className="p-4 border-b border-stone-50">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">First Name</label>
                                                <Input
                                                    value={formData.first_name}
                                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                                    className={`border-none p-0 h-auto focus-visible:ring-0 text-lg ${formErrors.first_name ? 'text-red-500' : ''}`}
                                                    placeholder="Required"
                                                />
                                            </div>
                                            <div className="p-4">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Last Name</label>
                                                <Input
                                                    value={formData.last_name}
                                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                                    className="border-none p-0 h-auto focus-visible:ring-0 text-lg"
                                                    placeholder="Required"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100">
                                            <div className="p-4 border-b border-stone-50">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Email Address</label>
                                                <Input
                                                    type="email"
                                                    value={formData.email}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                    className={`border-none p-0 h-auto focus-visible:ring-0 text-lg ${formErrors.email ? 'text-red-500' : ''}`}
                                                    placeholder="kyogongsbmt@gmail.com"
                                                />
                                            </div>
                                            <div className="p-4">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">National ID</label>
                                                <Input
                                                    value={formData.national_id}
                                                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                                                    className="border-none p-0 h-auto focus-visible:ring-0 text-lg"
                                                    placeholder="Required for ID card"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {wizardStep === 2 && (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100">
                                            <div className="p-4 border-b border-stone-50">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Position / Job Function</label>
                                                <Input
                                                    value={formData.position}
                                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                                    className="border-none p-0 h-auto focus-visible:ring-0 text-lg"
                                                    placeholder="e.g. Head Chef, HR Officer"
                                                />
                                            </div>
                                            <div className="p-4 border-b border-stone-50">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Department</label>
                                                <select
                                                    value={formData.department}
                                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                                    className="w-full bg-transparent border-none p-0 h-auto focus:ring-0 text-lg appearance-none cursor-pointer"
                                                >
                                                    <option value="">Select department</option>
                                                    {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="p-4 border-b border-stone-50">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Branch</label>
                                                <select
                                                    value={formData.branch_id}
                                                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                                    className="w-full bg-transparent border-none p-0 h-auto focus:ring-0 text-lg appearance-none cursor-pointer"
                                                >
                                                    <option value="">Select branch</option>
                                                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="p-4">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Immediate Supervisor</label>
                                                <select
                                                    value={formData.supervisor_id}
                                                    onChange={(e) => setFormData({ ...formData, supervisor_id: e.target.value })}
                                                    className="w-full bg-transparent border-none p-0 h-auto focus:ring-0 text-lg appearance-none cursor-pointer"
                                                >
                                                    <option value="">No Supervisor (Top Level)</option>
                                                    {staff.filter(s => s.id !== formData.id).map((s) => (
                                                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.role})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="p-4">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Basic Salary (Monthly) *</label>
                                                <Input
                                                    type="number"
                                                    value={formData.basic_salary}
                                                    onChange={(e) => setFormData({ ...formData, basic_salary: Number(e.target.value) })}
                                                    className={`border-none p-0 h-auto focus-visible:ring-0 text-lg ${formErrors.basic_salary ? 'text-red-500' : ''}`}
                                                    placeholder="Required for HR"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100 p-4 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium text-stone-700">Employment Status</label>
                                                <select
                                                    value={formData.status}
                                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                                                    className="bg-transparent border-none p-0 h-auto focus:ring-0 text-[#007AFF] font-bold text-right appearance-none cursor-pointer"
                                                >
                                                    <option value="active">Active</option>
                                                    <option value="inactive">Inactive</option>
                                                </select>
                                            </div>

                                            <div className="pt-4 border-t border-stone-50 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[13px] font-bold text-stone-700">NSSF Contribution</p>
                                                        <p className="text-[10px] text-stone-400">Social security savings</p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.nssf_enabled}
                                                        onChange={(e) => setFormData({ ...formData, nssf_enabled: e.target.checked })}
                                                        className="w-5 h-5 rounded-md border-stone-300 text-[#007AFF] focus:ring-[#007AFF]"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[13px] font-bold text-stone-700">SHIF Contribution</p>
                                                        <p className="text-[10px] text-stone-400">Health insurance fund</p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.shif_enabled}
                                                        onChange={(e) => setFormData({ ...formData, shif_enabled: e.target.checked })}
                                                        className="w-5 h-5 rounded-md border-stone-300 text-[#007AFF] focus:ring-[#007AFF]"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[13px] font-bold text-stone-700">Housing Fund</p>
                                                        <p className="text-[10px] text-stone-400">Affordable housing levy</p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.housing_fund_enabled}
                                                        onChange={(e) => setFormData({ ...formData, housing_fund_enabled: e.target.checked })}
                                                        className="w-5 h-5 rounded-md border-stone-300 text-[#007AFF] focus:ring-[#007AFF]"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {wizardStep === 3 && (
                                    <motion.div
                                        key="step3"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100">
                                            <div className="p-4 border-b border-stone-50">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Residential Address</label>
                                                <Input
                                                    value={formData.address}
                                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                    className="border-none p-0 h-auto focus-visible:ring-0 text-lg"
                                                    placeholder="Bomet, Kenya"
                                                />
                                            </div>
                                            <div className="p-4">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Personal Phone</label>
                                                <Input
                                                    value={formData.phone_number}
                                                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                                    className="border-none p-0 h-auto focus-visible:ring-0 text-lg"
                                                    placeholder="0706 782 828"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100">
                                            <div className="p-4 border-b border-stone-50 text-[#FF3B30] font-bold text-[10px] uppercase tracking-wider">Emergency Contact</div>
                                            <div className="p-4 border-b border-stone-50">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Full Name</label>
                                                <Input
                                                    value={formData.ec_name}
                                                    onChange={(e) => setFormData({ ...formData, ec_name: e.target.value })}
                                                    className="border-none p-0 h-auto focus-visible:ring-0 text-lg"
                                                    placeholder="Contact Name"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2">
                                                <div className="p-4 border-r border-stone-50">
                                                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Relationship</label>
                                                    <Input
                                                        value={formData.ec_relationship}
                                                        onChange={(e) => setFormData({ ...formData, ec_relationship: e.target.value })}
                                                        className="border-none p-0 h-auto focus-visible:ring-0 text-lg"
                                                        placeholder="Spouse"
                                                    />
                                                </div>
                                                <div className="p-4">
                                                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Phone</label>
                                                    <Input
                                                        value={formData.ec_phone}
                                                        onChange={(e) => setFormData({ ...formData, ec_phone: e.target.value })}
                                                        className="border-none p-0 h-auto focus-visible:ring-0 text-lg"
                                                        placeholder="Phone"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {wizardStep === 4 && (
                                    <motion.div
                                        key="step4"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-stone-100">
                                            <div className="p-4 border-b border-stone-50 font-bold text-[10px] text-[#007AFF] uppercase tracking-wider">System & POS Access</div>
                                            <div className="p-4 border-b border-stone-50">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">POS PIN (4-6 Digits)</label>
                                                <Input
                                                    value={formData.pos_pin}
                                                    onChange={(e) => setFormData({ ...formData, pos_pin: e.target.value.toUpperCase() })}
                                                    className="border-none p-0 h-auto focus-visible:ring-0 text-lg font-mono"
                                                    maxLength={6}
                                                    placeholder="RXXX, BXXX or CXXX"
                                                />
                                                <p className="text-[10px] text-stone-400 mt-1">Waiters: RXXX, Bar: BXXX, Cashier: CXXX</p>
                                            </div>
                                            <div className="p-4">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Assigned Shift</label>
                                                <select
                                                    value={formData.shift}
                                                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                                                    className="w-full bg-transparent border-none p-0 h-auto focus:ring-0 text-lg appearance-none cursor-pointer"
                                                >
                                                    <option value="morning">Morning</option>
                                                    <option value="afternoon">Afternoon</option>
                                                    <option value="night">Night</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                                            <p className="text-[11px] text-blue-600 leading-relaxed">
                                                Completing onboarding will create a system user account and a staff profile for ID card generation.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Navigation Bar */}
                            <div className="flex gap-4 mt-8">
                                {wizardStep > 1 && (
                                    <button
                                        onClick={() => setWizardStep(prev => prev - 1)}
                                        className="flex-1 py-3 px-4 rounded-xl bg-white border border-stone-200 text-stone-700 font-semibold active:bg-stone-50 transition-colors"
                                    >
                                        Back
                                    </button>
                                )}

                                {wizardStep < 4 ? (
                                    <button
                                        onClick={() => {
                                            if (wizardStep === 1) {
                                                const errors: any = {};
                                                if (!formData.first_name) errors.first_name = true;
                                                if (!formData.email) errors.email = true;
                                                if (Object.keys(errors).length > 0) {
                                                    setFormErrors(errors);
                                                    toast.error("Please fill in required fields");
                                                    return;
                                                }
                                            }
                                            setFormErrors({});
                                            setWizardStep(prev => prev + 1);
                                        }}
                                        className="flex-1 py-3 px-4 rounded-xl bg-[#007AFF] text-white font-semibold active:bg-[#0062CC] shadow-md transition-shadow"
                                    >
                                        Next
                                    </button>
                                ) : (
                                    <button
                                        onClick={addModalOpen ? handleCreateStaff : handleUpdateStaff}
                                        className="flex-1 py-3 px-4 rounded-xl bg-[#34C759] text-white font-semibold active:bg-[#2EB150] shadow-md"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Syncing...' : (addModalOpen ? 'Complete Onboarding' : 'Save Changes')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Archive Confirmation */}
                <Dialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
                    <DialogContent className="max-w-[400px] bg-white p-6 rounded-ios-2xl border-none shadow-2xl">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Archive className="h-6 w-6 text-amber-500" />
                            </div>
                            <h3 className="text-lg font-bold text-stone-900">Archive/Terminate Personnel</h3>
                            <p className="text-stone-500 text-sm mt-2 font-medium">This will mark the employee as terminated and log it in their history.</p>
                        </div>
                        <div className="mt-4">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Termination Notes / Reason</label>
                            <textarea
                                value={formData.archive_notes}
                                onChange={(e) => setFormData({ ...formData, archive_notes: e.target.value })}
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 min-h-[80px]"
                                placeholder="e.g. Contract ended, Resignation, etc."
                            />
                        </div>
                        <div className="flex flex-col gap-2 mt-6">
                            <IOSButton
                                onClick={handleConfirmArchive}
                                className="w-full bg-stone-900 hover:bg-stone-800 text-white border-none h-11"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Archiving...' : 'Archive Personnel'}
                            </IOSButton>
                            <IOSButton
                                variant="secondary"
                                onClick={() => setConfirmArchiveOpen(false)}
                                className="w-full h-11"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </IOSButton>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Detailed Profile View */}
                <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                    <DialogContent className="max-w-[700px] h-[80vh] bg-[#F2F2F7] p-0 overflow-hidden border-none rounded-ios-3xl shadow-2xl flex flex-col">
                        <div className="bg-white/80 backdrop-blur-xl px-6 py-4 border-b flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 font-bold text-lg">
                                    {selectedStaff?.first_name?.[0]}{selectedStaff?.last_name?.[0]}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-stone-900">{selectedStaff?.first_name} {selectedStaff?.last_name}</h3>
                                    <p className="text-sm text-[#007AFF] font-semibold">{selectedStaff?.role}</p>
                                </div>
                            </div>
                            <button onClick={() => setDetailModalOpen(false)} className="text-[#007AFF] font-semibold">Done</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Employment History Timeline */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <History className="h-5 w-5 text-stone-400" />
                                    <h4 className="text-[13px] font-bold text-stone-400 uppercase tracking-widest">Employment Timeline</h4>
                                </div>
                                <div className="space-y-4">
                                    {history.length > 0 ? (
                                        history.map((item, idx) => (
                                            <div key={item.id} className="relative pl-6 pb-4 border-l border-stone-200 last:border-0 last:pb-0">
                                                <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-stone-900 ring-4 ring-white" />
                                                <span className="text-[10px] text-stone-400 font-bold block mb-1">
                                                    {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                <p className="text-[14px] font-bold text-stone-800 capitalize">{item.change_type.replace(/_/g, ' ')}</p>
                                                {item.old_value && (
                                                    <p className="text-[12px] text-stone-500 mt-1">
                                                        Changed from <span className="font-semibold">{item.old_value}</span> to <span className="font-semibold">{item.new_value}</span>
                                                    </p>
                                                )}
                                                {item.notes && <p className="text-[12px] text-stone-400 italic mt-1">"{item.notes}"</p>}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="bg-white p-6 rounded-2xl border border-stone-100 text-center text-stone-400 text-sm italic">
                                            No history recorded yet.
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Document Center */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText className="h-5 w-5 text-stone-400" />
                                    <h4 className="text-[13px] font-bold text-stone-400 uppercase tracking-widest">Document Vault</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {['National ID', 'Contract', 'CV', 'Certification'].map((type) => {
                                        const doc = documents.find(d => d.document_type === type);
                                        return (
                                            <div key={type} className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm relative group overflow-hidden">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-2 rounded-lg ${doc ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-stone-50 text-stone-300'}`}>
                                                            <FileText className="h-4 w-4" />
                                                        </div>
                                                        <span className="text-sm font-bold text-stone-700">{type}</span>
                                                    </div>
                                                    {doc && (
                                                        <IOSBadge variant="outline" className="text-[10px]">VERIFIED</IOSBadge>
                                                    )}
                                                </div>

                                                {doc ? (
                                                    <div className="mt-2 flex items-center justify-between">
                                                        <span className="text-[11px] text-stone-400 truncate max-w-[120px]">{doc.file_name}</span>
                                                        <a
                                                            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/staff-documents/${doc.file_path}`}
                                                            target="_blank"
                                                            className="text-[11px] text-[#007AFF] font-bold hover:underline"
                                                        >
                                                            View File
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <div className="mt-2">
                                                        <label className="cursor-pointer text-[11px] text-[#007AFF] font-bold flex items-center gap-1 hover:bg-[#007AFF]/5 w-fit px-2 py-1 rounded-lg transition-colors">
                                                            <Plus className="h-3 w-3" />
                                                            Upload {type}
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                onChange={(e) => handleUploadDocument(e, type)}
                                                                accept=".pdf,.jpg,.jpeg,.png"
                                                            />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    </DialogContent>
                </Dialog>

            </DashboardLayout>
        </ProtectedRoute>
    );
}
