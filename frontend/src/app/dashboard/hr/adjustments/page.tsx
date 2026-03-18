'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { payrollAPI, staffAPI } from '@/lib/api';
import {
    Plus,
    Search,
    Filter,
    Calendar,
    ArrowUpCircle,
    ArrowDownCircle,
    XCircle,
    RefreshCw,
    MoreHorizontal,
    User,
    Clock,
    CheckCircle2,
    DollarSign,
    MinusCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { AddAdjustmentDialog } from '@/components/hr/add-adjustment-dialog';

export default function PayrollAdjustmentsPage() {
    const { user } = useAuth();
    const canManage = [UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR].includes(user?.role as UserRole);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [adjustments, setAdjustments] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    // Dialog state
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newAdjustment, setNewAdjustment] = useState({
        staff_id: '',
        type: 'deduction' as 'deduction' | 'addition',
        category: 'other',
        amount: '',
        description: '',
        month: String(new Date().getMonth() + 1),
        year: new Date().getFullYear()
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [adjustmentsRes, staffRes] = await Promise.all([
                payrollAPI.getAdjustments({
                    month: selectedMonth,
                    year: selectedYear,
                    type: typeFilter !== 'all' ? typeFilter : undefined
                }),
                staffAPI.getAll()
            ]);

            if (adjustmentsRes.success) {
                setAdjustments(adjustmentsRes.data || []);
            }
            if (staffRes.success) {
                setStaffList(staffRes.data || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [selectedMonth, selectedYear, typeFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateAdjustment = async () => {
        if (!newAdjustment.staff_id || !newAdjustment.amount || Number(newAdjustment.amount) <= 0) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await payrollAPI.createAdjustment({
                ...newAdjustment,
                amount: Number(newAdjustment.amount),
                month: newAdjustment.month,
                year: Number(newAdjustment.year)
            });

            if (res.success) {
                toast.success('Adjustment added successfully');
                setIsAddDialogOpen(false);
                setNewAdjustment({
                    staff_id: '',
                    type: 'deduction',
                    category: 'other',
                    amount: '',
                    description: '',
                    month: String(new Date().getMonth() + 1),
                    year: new Date().getFullYear()
                });
                fetchData();
            } else {
                toast.error(res.message || 'Failed to add adjustment');
            }
        } catch (error: any) {
            toast.error(error.message || 'Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVoidAdjustment = async (id: string) => {
        if (!confirm('Are you sure you want to void this adjustment? This action cannot be undone.')) {
            return;
        }

        try {
            const res = await payrollAPI.voidAdjustment(id);
            if (res.success) {
                toast.success('Adjustment voided');
                fetchData();
            } else {
                toast.error(res.message || 'Failed to void adjustment');
            }
        } catch (error: any) {
            toast.error(error.message || 'Operation failed');
        }
    };

    const filteredAdjustments = adjustments.filter(adj => {
        const staffName = `${adj.staff_name}`.toLowerCase();
        return staffName.includes(searchQuery.toLowerCase());
    });

    const categoryLabels: Record<string, string> = {
        credit_bill: 'Credit Bill',
        advance: 'Salary Advance',
        loan_installment: 'Loan Installment',
        nssf: 'NSSF',
        shif: 'SHIF',
        paye: 'PAYE',
        housing_levy: 'Housing Levy',
        uniform: 'Uniform Deduction',
        absent_day: 'Absent Day',
        contribution: 'Contribution',
        extra_day: 'Extra Day Payment',
        bonus: 'Performance Bonus',
        overtime: 'Overtime Payment',
        allowance: 'Travel/Fuel Allowance',
        unpaid_leave: 'Unpaid Leave',
        penalty: 'Disciplinary Fine',
        other: 'Other'
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6 animate-ios-fade-in p-2">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Payroll Adjustments</h1>
                            <p className="text-stone-500 text-sm">Manage employee deductions and extra payments</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="w-[120px] bg-white border-stone-200">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <SelectItem key={m} value={String(m)}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-[100px] bg-white border-stone-200">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {canManage && (
                                <button
                                    onClick={() => setIsAddDialogOpen(true)}
                                    className="px-5 py-2 rounded-full bg-stone-900 text-white text-sm font-bold hover:bg-black transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-stone-200"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add Adjustment</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <IOSCard className="p-4 flex flex-col justify-center text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                                    <ArrowDownCircle className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Deductions</span>
                            </div>
                            <p className="text-2xl font-bold text-stone-900">
                                KES {adjustments.filter(a => a.type === 'deduction' && a.status !== 'cancelled').reduce((sum, a) => sum + Number(a.amount), 0).toLocaleString()}
                            </p>
                        </IOSCard>

                        <IOSCard className="p-4 flex flex-col justify-center text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <ArrowUpCircle className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Additions</span>
                            </div>
                            <p className="text-2xl font-bold text-stone-900">
                                KES {adjustments.filter(a => a.type === 'addition' && a.status !== 'cancelled').reduce((sum, a) => sum + Number(a.amount), 0).toLocaleString()}
                            </p>
                        </IOSCard>

                        <IOSCard className="p-4 flex flex-col justify-center text-left border-l-4 border-l-stone-900">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-stone-100 text-stone-600 rounded-lg">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Pending Adjustments</span>
                            </div>
                            <p className="text-2xl font-bold text-stone-900">
                                {adjustments.filter(a => a.status === 'pending').length}
                            </p>
                        </IOSCard>
                    </div>

                    {/* Content Section */}
                    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm flex flex-col min-h-[500px]">
                        <div className="p-4 border-b border-stone-50 flex flex-wrap items-center justify-between gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                                <input
                                    placeholder="Search staff name..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger className="w-[150px] bg-stone-50 border-stone-100 rounded-xl h-10">
                                        <Filter className="h-3.5 w-3.5 mr-2 text-stone-400" />
                                        <SelectValue placeholder="All Types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="deduction">Deductions</SelectItem>
                                        <SelectItem value="addition">Additions</SelectItem>
                                    </SelectContent>
                                </Select>

                                <button onClick={fetchData} className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 hover:bg-stone-100 transition-colors">
                                    <RefreshCw className={`h-4 w-4 text-stone-600 ${isLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Adjustments Table */}
                        <div className="overflow-x-auto text-left">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-stone-50/50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-4 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider">Staff Member</th>
                                        <th className="px-4 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider">Category</th>
                                        <th className="px-4 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider">Description</th>
                                        <th className="px-4 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">Amount</th>
                                        <th className="px-4 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-center">Status</th>
                                        <th className="px-4 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider">Date Added</th>
                                        <th className="px-4 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr><td colSpan={7} className="p-8 text-center text-stone-400">Loading adjustments...</td></tr>
                                    ) : filteredAdjustments.length === 0 ? (
                                        <tr><td colSpan={7} className="p-8 text-center text-stone-400">No adjustments found for this period.</td></tr>
                                    ) : (
                                        filteredAdjustments.map((adj) => (
                                            <tr key={adj.id} className="hover:bg-stone-50/50 transition-colors group">
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500">
                                                            <User className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-stone-900">{adj.staff_name}</p>
                                                            <p className="text-[10px] text-stone-500 uppercase tracking-wider">{adj.staff_role}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <IOSBadge color={adj.type === 'deduction' ? 'danger' : 'success'} className="text-[10px]">
                                                        {categoryLabels[adj.category] || adj.category}
                                                    </IOSBadge>
                                                </td>
                                                <td className="px-4 py-4 max-w-xs truncate text-stone-600">
                                                    {adj.description || '-'}
                                                </td>
                                                <td className="px-4 py-4 text-right font-bold">
                                                    <span className={adj.type === 'deduction' ? 'text-red-600' : 'text-emerald-600'}>
                                                        {adj.type === 'deduction' ? '-' : '+'} KES {Number(adj.amount).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${adj.status === 'applied' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                                        adj.status === 'pending' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                                            'bg-stone-50 border-stone-100 text-stone-400'
                                                        }`}>
                                                        {adj.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-xs text-stone-500">
                                                    {new Date(adj.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    {adj.status === 'pending' && canManage && (
                                                        <button
                                                            onClick={() => handleVoidAdjustment(adj.id)}
                                                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Void Adjustment"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Add Adjustment Dialog */}
                <AddAdjustmentDialog 
                    open={isAddDialogOpen}
                    onOpenChange={setIsAddDialogOpen}
                    onSuccess={fetchData}
                />
            </DashboardLayout>
        </ProtectedRoute>
    );
}
