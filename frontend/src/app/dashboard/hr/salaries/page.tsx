'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI, systemAPI, storeAPI } from '@/lib/api';
import {
    DollarSign,
    RefreshCw,
    Search,
    Filter,
    TrendingUp,
    User,
    ArrowUpRight,
    ChevronRight,
    Edit2,
    Wallet,
    Building2,
    CreditCard,
    ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SalaryRecord {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
    department: string;
    basic_salary: number; // Changed from salary
    branch_name?: string;
    bank_name?: string;
    account_number?: string;
}

export default function HRSalariesPage() {
    const { user } = useAuth();
    const [staff, setStaff] = useState<SalaryRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<SalaryRecord | null>(null);
    const [newSalary, setNewSalary] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchStaffSalaries = useCallback(async () => {
        setIsLoading(true);
        try {

            // Role guard: only permitted roles may call getSystemUsers (backend requires SUPER_ADMIN, GM, HR_MANAGER, AUDITOR)
            const canFetchUsers = user && [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR].includes(user.role as UserRole);

            const [staffRes, driversRes, usersRes] = await Promise.all([
                staffAPI.getStaff({ limit: 1000 }),
                storeAPI.getDrivers(),
                canFetchUsers ? systemAPI.getSystemUsers() : Promise.resolve({ success: true, data: [] }),
            ]);

            const isGuest = (u: any) => {
                const role = (u.role || '').toLowerCase();
                const firstName = (u.first_name || '').toLowerCase();
                const lastName = (u.last_name || '').toLowerCase();
                const fullName = (u.name || '').toLowerCase();
                return role === 'guest' ||
                    firstName.includes('guest') ||
                    lastName.includes('guest') ||
                    fullName.includes('guest');
            };

            const rawDrivers: any[] = (driversRes?.data || []).filter((d: any) => !isGuest(d));
            const rawUsers: any[] = (usersRes?.data || []).filter((u: any) => !isGuest(u));
            const rawRegular: any[] = (staffRes.success ? (staffRes.data || []) : []).filter((s: any) => !isGuest(s));


            // Role-to-dept map (must match backend valid_department constraint)
            const roleToDept: Record<string, string> = {
                waiter: 'restaurant', waitress: 'restaurant', head_waiter: 'restaurant',
                restaurant: 'restaurant', kitchen: 'restaurant', pos_kitchen: 'restaurant',
                kitchen_operations: 'restaurant', kitchen_helper: 'restaurant',
                head_chef: 'restaurant', sous_chef: 'restaurant', chef: 'restaurant',
                cook: 'restaurant', line_cook: 'restaurant', prep_cook: 'restaurant',
                food_runner: 'restaurant', busser: 'restaurant', host_hostess: 'restaurant', dishwasher: 'restaurant',
                bartender: 'bar_lounge', barista: 'bar_lounge', barman: 'bar_lounge',
                barmaid: 'bar_lounge', bar_manager: 'bar_lounge',
                receptionist: 'reception', concierge: 'reception', bell_captain: 'reception', bellhop: 'reception',
                housekeeping: 'housekeeping', room_attendant: 'housekeeping', laundry_attendant: 'housekeeping',
                maintenance: 'maintenance', electrician: 'maintenance', plumber: 'maintenance',
                hvac_technician: 'maintenance', groundskeeper: 'maintenance',
                security: 'security', security_guard: 'security',
                cashier: 'administration', kyogong_spa_cashier: 'administration',
                kyogong_executive_bar_cashier: 'administration', kyogong_sports_bar_cashier: 'administration',
                kyogong_reception_cashier: 'administration', procurement: 'administration',
                central_storekeeper: 'administration', branch_storekeeper: 'administration',
                storekeeper: 'administration', employee: 'administration',
                accountant: 'finance', auditor: 'finance', branch_accountant: 'finance',
                night_auditor: 'finance', payroll_clerk: 'finance', finance_manager: 'finance',
                super_admin: 'management', admin: 'management', manager: 'management',
                general_manager: 'management', branch_manager: 'management', hr_manager: 'management',
                branch_operations_manager: 'management', central_operations_manager: 'management',
                facilities_manager: 'management', restaurant_manager: 'management',
                maintenance_supervisor: 'management', housekeeping_supervisor: 'management',
                front_desk_supervisor: 'management', security_supervisor: 'management',
            };

            const mergedMap = new Map<string, SalaryRecord>();

            // 1. Process Raw Users First
            rawUsers.forEach((u: any) => {
                if (u.role === 'guest') return;
                mergedMap.set(u.id, {
                    id: u.id,
                    first_name: u.first_name || '',
                    last_name: u.last_name || '',
                    role: u.role || 'user',
                    department: roleToDept[u.role] || 'general',
                    basic_salary: u.basic_salary || 0,
                    bank_name: u.bank_name || '',
                    account_number: u.account_number || '',
                });
            });

            // 2. Process Drivers
            rawDrivers.forEach((d: any) => {
                const nameParts = (d.name || '').trim().split(' ');
                const fName = nameParts[0] || d.name || '';
                const lName = nameParts.slice(1).join(' ') || '';

                mergedMap.set(d.id, {
                    id: d.id,
                    first_name: fName,
                    last_name: lName,
                    role: 'driver',
                    department: 'general',
                    basic_salary: d.basic_salary || parseInt(d.salary) || parseInt(d.salary_amount) || 0,
                    bank_name: d.bank_name || '',
                    account_number: d.account_number || '',
                });
            });

            // 3. Process Staff Profiles (Overlay actual salary data)
            rawRegular.forEach((s: any) => {
                const mapKey = s.user_id || s.id;

                if (mergedMap.has(mapKey)) {
                    // Update existing user/driver with actual staff_profile data
                    const existing = mergedMap.get(mapKey)!;
                    existing.basic_salary = s.basic_salary !== undefined ? s.basic_salary : existing.basic_salary;
                    existing.bank_name = s.bank_name || existing.bank_name;
                    existing.account_number = s.account_number || existing.account_number;
                    // If the component needs the staff_profile ID for updates, use it, but keep the role
                    existing.id = s.id;
                } else {
                    // Add if not present at all
                    mergedMap.set(mapKey, {
                        id: s.id,
                        first_name: s.first_name || '',
                        last_name: s.last_name || '',
                        role: s.role || 'Staff',
                        department: s.department || 'general',
                        basic_salary: s.basic_salary || 0,
                        bank_name: s.bank_name || '',
                        account_number: s.account_number || '',
                    });
                }
            });

            setStaff(Array.from(mergedMap.values()));
        } catch (error) {
            console.error('Error fetching salaries:', error);
            toast.error('Failed to load salary data');
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchStaffSalaries();
    }, [fetchStaffSalaries]);

    const filteredStaff = staff.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.department.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = {
        totalBudget: staff.reduce((sum, s) => sum + Number(s.basic_salary || 0), 0),
        avgSalary: staff.length > 0 ? staff.reduce((sum, s) => sum + Number(s.basic_salary || 0), 0) / staff.length : 0,
        count: staff.length
    };

    const handleEditSalary = (s: SalaryRecord) => {
        setSelectedStaff(s);
        setNewSalary((s.basic_salary || 0).toString());
        setEditModalOpen(true);
    };

    const handleUpdateSalary = async () => {
        if (!selectedStaff || !newSalary) return;
        setIsSubmitting(true);
        try {
            // Drivers don't have staff_profiles right now, we update them via storeAPI directly
            if (selectedStaff.role === 'driver') {
                await storeAPI.updateDriver(selectedStaff.id, { basic_salary: Number(newSalary) });
            } else {
                await staffAPI.updateStaffMember(selectedStaff.id, { basic_salary: Number(newSalary) });
            }
            toast.success(`Salary updated for ${selectedStaff.first_name}`);
            setEditModalOpen(false);
            fetchStaffSalaries();
        } catch (error: any) {
            toast.error(error.message || 'Update failed');
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
                            <h1 className="text-[28px] font-bold text-stone-900 tracking-tight font-sf-pro-display">Payroll Baseline</h1>
                            <p className="text-stone-500 font-medium">Manage employee contract rates and disbursements</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchStaffSalaries}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-full border border-stone-200 bg-white text-stone-600 text-sm font-bold hover:bg-stone-50 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Sync Ledger</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-6 rounded-2xl bg-stone-900 text-white shadow-xl shadow-stone-200/50 flex flex-col justify-between min-h-[140px]">
                            <div className="flex justify-between items-start">
                                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Base Liability</p>
                                <Wallet className="h-5 w-5 text-stone-500" />
                            </div>
                            <div>
                                <p className="text-[11px] text-stone-400 font-medium mb-1">Monthly Payroll Budget</p>
                                <p className="text-3xl font-bold tracking-tight">
                                    <span className="text-stone-500 text-xl mr-1 font-medium">KES</span>
                                    {stats.totalBudget.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="p-6 rounded-2xl bg-white border border-stone-100 border-l-4 border-l-blue-500 shadow-sm flex flex-col justify-between min-h-[140px] transition-all hover:border-stone-200">
                            <div className="flex justify-between items-start">
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Averaged Scale</p>
                                <TrendingUp className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-[11px] text-stone-400 font-medium mb-1">Comp Ratio Per Head</p>
                                <p className="text-2xl font-bold text-stone-900">
                                    <span className="text-stone-400 text-lg mr-1 font-medium italic">~</span>
                                    {Math.round(stats.avgSalary).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="p-6 rounded-2xl bg-white border border-stone-100 border-l-4 border-l-indigo-500 shadow-sm flex flex-col justify-between min-h-[140px] transition-all hover:border-stone-200">
                            <div className="flex justify-between items-start">
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Resource Count</p>
                                <User className="h-5 w-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-[11px] text-stone-400 font-medium mb-1">Total Active Contracts</p>
                                <p className="text-2xl font-bold text-stone-900">{stats.count} Members</p>
                            </div>
                        </div>
                    </div>

                    {/* Integrated Controls */}
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-stone-50 p-2 rounded-2xl border border-stone-100">
                        <div className="flex items-center bg-white rounded-xl border border-stone-200 p-1 shadow-sm w-full lg:w-auto">
                            <div className="px-4 py-2 border-r border-stone-100">
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none">Filters</p>
                            </div>
                            <div className="flex gap-1 p-1">
                                {['All Roles', 'Management', 'Operations', 'Kitchen'].map((f) => (
                                    <button key={f} className="px-3 py-1.5 text-[12px] font-bold text-stone-500 hover:text-stone-900 rounded-lg transition-all hover:bg-stone-50">
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative w-full lg:w-[320px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                placeholder="Search by name or department..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-[13px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all placeholder:text-stone-400 shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-stone-50/50 border-b border-stone-100">
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Personnel</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Post / Unit</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Contract Rate</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Settlement Info</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Verification</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-200 mb-2" />
                                                <p className="text-stone-400 text-[13px] font-medium">Synchronizing rates...</p>
                                            </td>
                                        </tr>
                                    ) : filteredStaff.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-stone-400 font-medium italic">
                                                No personnel records matching your query
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStaff.map((s) => (
                                            <tr key={s.id} className="hover:bg-stone-50/30 transition-all group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 font-bold text-xs">
                                                            {s.first_name?.[0] || '?'}{s.last_name?.[0] || '?'}
                                                        </div>
                                                        <span className="text-[13px] font-bold text-stone-900">{s.first_name || 'Unknown'} {s.last_name || 'Staff'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-[13px] font-bold text-stone-700 leading-none">{s.role}</p>
                                                    <p className="text-[10px] text-stone-400 font-bold mt-1.5 uppercase tracking-tighter">{s.department}</p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-[14px] font-bold text-stone-900 group-hover:text-emerald-600 transition-colors">
                                                        {Number(s.basic_salary || 0).toLocaleString()} <span className="text-[10px] text-stone-400 font-medium ml-0.5">KES</span>
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-stone-500">
                                                        <div className="px-2 py-0.5 rounded bg-stone-50 border border-stone-200 text-[10px] font-bold uppercase text-stone-400">
                                                            {s.bank_name ? 'Bank' : 'No Sett.'}
                                                        </div>
                                                        <span className="text-[12px] font-bold text-stone-600 truncate max-w-[120px]">
                                                            {s.bank_name || 'Unset'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleEditSalary(s)}
                                                        className="h-8 px-4 rounded-lg border border-stone-200 text-stone-600 text-[12px] font-bold hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all active:scale-95"
                                                    >
                                                        Adjust Rate
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Edit Salary Modal */}
                <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                    <DialogContent className="max-w-[360px] bg-white p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                        <div className="px-6 pt-8 pb-6 text-center bg-stone-50 border-b border-stone-100">
                            <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-stone-100 flex items-center justify-center mx-auto mb-4">
                                <DollarSign className="h-7 w-7 text-emerald-500" />
                            </div>
                            <DialogTitle className="text-xl font-bold text-stone-900 tracking-tight">Contract Adjustment</DialogTitle>
                            <p className="text-stone-500 text-[13px] mt-1.5 font-bold uppercase tracking-widest">{selectedStaff?.first_name || 'Unknown'} {selectedStaff?.last_name || 'Staff'}</p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Proposed Monthly Baseline (KES)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">KES</span>
                                    <input
                                        type="number"
                                        value={newSalary}
                                        onChange={(e) => setNewSalary(e.target.value)}
                                        className="w-full h-14 pl-14 pr-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={handleUpdateSalary}
                                    disabled={isSubmitting}
                                    className="w-full h-12 bg-stone-900 text-white rounded-xl font-bold text-[14px] hover:bg-black transition-all active:scale-95 shadow-lg shadow-stone-200 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            <span>Updating Ledger...</span>
                                        </>
                                    ) : (
                                        <span>Confirm Rate Change</span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setEditModalOpen(false)}
                                    className="w-full h-12 bg-white border border-stone-200 text-stone-600 rounded-xl font-bold text-[14px] hover:bg-stone-50 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
