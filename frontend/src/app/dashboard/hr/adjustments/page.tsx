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

export default function PayrollAdjustmentsPage() {
    const { user } = useAuth();
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
        bonus: 'Bonus',
        other: 'Other'
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
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

                            <button
                                onClick={() => setIsAddDialogOpen(true)}
                                className="px-5 py-2 rounded-full bg-stone-900 text-white text-sm font-bold hover:bg-black transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-stone-200"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Add Adjustment</span>
                            </button>
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
                                                    {adj.status === 'pending' && (
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
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogContent className="sm:max-w-[450px] p-0 border-none rounded-3xl overflow-hidden shadow-2xl animate-ios-slide-in text-left">
                        <DialogHeader className="p-6 bg-stone-900 text-white">
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <Plus className="h-5 w-5" />
                                New Adjustment
                            </DialogTitle>
                        </DialogHeader>

                        <div className="p-6 space-y-5 bg-white">
                            <div className="space-y-2">
                                <Label className="text-stone-500 font-bold uppercase text-[10px] tracking-widest pl-1">Employee</Label>
                                <Select
                                    value={newAdjustment.staff_id}
                                    onValueChange={(val) => setNewAdjustment(prev => ({ ...prev, staff_id: val }))}
                                >
                                    <SelectTrigger className="rounded-xl border-stone-100 h-11 bg-stone-50/50">
                                        <SelectValue placeholder="Select staff member" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[250px]">
                                        {staffList.map((staff) => (
                                            <SelectItem key={staff.id} value={staff.id}>
                                                {staff.first_name} {staff.last_name} ({staff.role})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-stone-500 font-bold uppercase text-[10px] tracking-widest pl-1">Type</Label>
                                    <Select
                                        value={newAdjustment.type}
                                        onValueChange={(val: any) => setNewAdjustment(prev => ({ ...prev, type: val }))}
                                    >
                                        <SelectTrigger className="rounded-xl border-stone-100 h-11 bg-stone-50/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="deduction">Deduction</SelectItem>
                                            <SelectItem value="addition">Addition</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-stone-500 font-bold uppercase text-[10px] tracking-widest pl-1">Category</Label>
                                    <Select
                                        value={newAdjustment.category}
                                        onValueChange={(val) => setNewAdjustment(prev => ({ ...prev, category: val }))}
                                    >
                                        <SelectTrigger className="rounded-xl border-stone-100 h-11 bg-stone-50/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {newAdjustment.type === 'deduction' ? (
                                                <>
                                                    <SelectItem value="credit_bill">Credit Bill</SelectItem>
                                                    <SelectItem value="advance">Salary Advance</SelectItem>
                                                    <SelectItem value="loan_installment">Loan Installment</SelectItem>
                                                    <SelectItem value="uniform">Uniform</SelectItem>
                                                    <SelectItem value="absent_day">Absent Day</SelectItem>
                                                    <SelectItem value="contribution">Contribution</SelectItem>
                                                    <SelectItem value="other">Other Deduction</SelectItem>
                                                </>
                                            ) : (
                                                <>
                                                    <SelectItem value="extra_day">Extra Day Payment</SelectItem>
                                                    <SelectItem value="bonus">Bonus</SelectItem>
                                                    <SelectItem value="other">Other Addition</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-stone-500 font-bold uppercase text-[10px] tracking-widest pl-1">Amount (KES)</Label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        className="rounded-xl border-stone-100 h-11 bg-stone-50/50 font-bold"
                                        value={newAdjustment.amount}
                                        onChange={(e) => setNewAdjustment(prev => ({ ...prev, amount: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-stone-500 font-bold uppercase text-[10px] tracking-widest pl-1">Period (Month/Year)</Label>
                                    <div className="flex gap-2">
                                        <Select
                                            value={newAdjustment.month}
                                            onValueChange={(val) => setNewAdjustment(prev => ({ ...prev, month: val }))}
                                        >
                                            <SelectTrigger className="rounded-xl border-stone-100 h-11 bg-stone-50/50 flex-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                    <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={String(newAdjustment.year)}
                                            onValueChange={(val) => setNewAdjustment(prev => ({ ...prev, year: Number(val) }))}
                                        >
                                            <SelectTrigger className="rounded-xl border-stone-100 h-11 bg-stone-50/50 flex-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[2024, 2025, 2026, 2027].map(y => (
                                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-stone-500 font-bold uppercase text-[10px] tracking-widest pl-1">Description (Optional)</Label>
                                <textarea
                                    className="w-full p-4 rounded-xl border border-stone-100 bg-stone-50/50 text-sm focus:ring-2 focus:ring-stone-900/5 transition-all outline-none min-h-[80px]"
                                    placeholder="Enter reason or notes..."
                                    value={newAdjustment.description}
                                    onChange={(e) => setNewAdjustment(prev => ({ ...prev, description: e.target.value }))}
                                ></textarea>
                            </div>
                        </div>

                        <DialogFooter className="p-6 bg-stone-50 mt-0">
                            <button
                                onClick={() => setIsAddDialogOpen(false)}
                                className="px-6 py-2.5 rounded-full text-stone-500 font-bold text-sm hover:bg-stone-100 transition-all mr-2"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateAdjustment}
                                disabled={isSubmitting}
                                className="px-8 py-2.5 rounded-full bg-stone-900 text-white font-bold text-sm hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Save Adjustment
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
