'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI } from '@/lib/api';
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
    CreditCard
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
    salary: number;
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
            const response = await staffAPI.getStaff();
            if (response.success) setStaff(response.data || []);
        } catch (error) {
            console.error('Error fetching salaries:', error);
            toast.error('Failed to load salary data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStaffSalaries();
    }, [fetchStaffSalaries]);

    const filteredStaff = staff.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.department.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = {
        totalBudget: staff.reduce((sum, s) => sum + Number(s.salary || 0), 0),
        avgSalary: staff.length > 0 ? staff.reduce((sum, s) => sum + Number(s.salary || 0), 0) / staff.length : 0,
        count: staff.length
    };

    const handleEditSalary = (s: SalaryRecord) => {
        setSelectedStaff(s);
        setNewSalary(s.salary.toString());
        setEditModalOpen(true);
    };

    const handleUpdateSalary = async () => {
        if (!selectedStaff || !newSalary) return;
        setIsSubmitting(true);
        try {
            await staffAPI.updateStaffMember(selectedStaff.id, { salary: Number(newSalary) });
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
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Staff Salaries</h1>
                            <p className="text-stone-500 mt-0.5">Manage employee pay rates and bank details</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchStaffSalaries} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                                Refresh
                            </IOSButton>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <IOSCard className="p-4 bg-stone-900 text-white border-none shadow-xl shadow-stone-200">
                            <Wallet className="h-5 w-5 text-stone-400 mb-2" />
                            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Base Monthly Budget</p>
                            <p className="text-2xl font-bold tracking-tight">KES {stats.totalBudget.toLocaleString()}</p>
                        </IOSCard>
                        <IOSCard className="p-4 border-l-4 border-l-blue-500">
                            <TrendingUp className="h-5 w-5 text-blue-600 mb-2" />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Average Salary</p>
                            <p className="text-2xl font-bold text-stone-900">KES {Math.round(stats.avgSalary).toLocaleString()}</p>
                        </IOSCard>
                        <IOSCard className="p-4 border-l-4 border-l-purple-500">
                            <User className="h-5 w-5 text-purple-600 mb-2" />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Employee Count</p>
                            <p className="text-2xl font-bold text-stone-900">{stats.count}</p>
                        </IOSCard>
                    </div>

                    <IOSCard className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <Input
                                placeholder="Search by name, role, or department..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-11 bg-stone-50 border-stone-100"
                            />
                        </div>
                    </IOSCard>

                    <IOSCard className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-stone-50/50">
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Employee</th>
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Position</th>
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider text-right">Base Salary</th>
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Payment Info</th>
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-20 text-center">
                                                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-200 mb-2" />
                                                <p className="text-stone-400 text-sm font-medium">Loading salary list...</p>
                                            </td>
                                        </tr>
                                    ) : filteredStaff.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-20 text-center">
                                                <DollarSign className="h-12 w-12 mx-auto text-stone-200 mb-4" />
                                                <p className="text-stone-500">No employees matching your search</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredStaff.map((s) => (
                                            <tr key={s.id} className="hover:bg-stone-50/50 transition-colors group">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center text-stone-600 font-bold text-xs border border-stone-100 uppercase tracking-tight">
                                                            {s.first_name[0]}{s.last_name[0]}
                                                        </div>
                                                        <span className="text-sm font-bold text-stone-900">{s.first_name} {s.last_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-[12px] font-semibold text-stone-800">{s.role}</p>
                                                    <p className="text-[11px] text-stone-400 font-bold uppercase tracking-tight">{s.department}</p>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <span className="text-sm font-bold text-emerald-600">KES {Number(s.salary || 0).toLocaleString()}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2 text-stone-500">
                                                        <CreditCard className="h-3.5 w-3.5" />
                                                        <span className="text-[12px] font-medium">{s.bank_name || 'No Bank Set'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <IOSButton
                                                        variant="secondary"
                                                        size="sm"
                                                        className="h-8 group-hover:bg-stone-900 group-hover:text-white transition-all shadow-none border-stone-100"
                                                        onClick={() => handleEditSalary(s)}
                                                        leftIcon={<Edit2 className="h-3 w-3" />}
                                                    >
                                                        Update
                                                    </IOSButton>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>
                </div>

                {/* Edit Salary Modal */}
                <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                    <DialogContent className="max-w-[320px] bg-white p-6 rounded-ios-2xl border-none shadow-2xl">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                                <DollarSign className="h-6 w-6 text-emerald-600" />
                            </div>
                            <h3 className="text-lg font-bold text-stone-900">Update Base Pay</h3>
                            <p className="text-stone-500 text-sm mt-1 font-medium">{selectedStaff?.first_name} {selectedStaff?.last_name}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">New Monthly Salary (KES)</label>
                                <Input
                                    type="number"
                                    value={newSalary}
                                    onChange={(e) => setNewSalary(e.target.value)}
                                    className="h-11 bg-stone-50 border-stone-100 font-bold text-stone-900"
                                    autoFocus
                                />
                            </div>

                            <div className="flex flex-col gap-2 pt-4">
                                <IOSButton
                                    onClick={handleUpdateSalary}
                                    className="w-full h-11 bg-stone-900 hover:bg-black"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Updating...' : 'Save New Salary'}
                                </IOSButton>
                                <IOSButton
                                    variant="secondary"
                                    onClick={() => setEditModalOpen(false)}
                                    className="w-full h-11"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </IOSButton>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
