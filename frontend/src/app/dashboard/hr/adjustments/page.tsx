'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { payrollAPI, staffAPI } from '@/lib/api';
import {
    Plus, Search, ArrowUpCircle, ArrowDownCircle, XCircle,
    RefreshCw, User, Clock, ChevronRight, CheckCircle2, X
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams } from 'next/navigation';

const CATEGORIES_DEDUCTION = [
    { id: 'credit_bills', label: 'Credit Bills' },
    { id: 'absenteeism', label: 'Absenteeism Deduction' },
    { id: 'loan', label: 'Loans' },
    { id: 'advance', label: 'Advances' },
    { id: 'shif', label: 'SHIF' },
    { id: 'nssf', label: 'NSSF' },
    { id: 'uniform', label: 'Uniform' },
    { id: 'other', label: 'Other Deductions' },
];
const ALLOWED_DEDUCTION_IDS = CATEGORIES_DEDUCTION.map(c => c.id);
const CATEGORIES_ADDITION = [
    { id: 'bonus', label: 'Performance Bonus' },
    { id: 'overtime', label: 'Overtime' },
    { id: 'allowance', label: 'Allowance' },
    { id: 'extra_day', label: 'Extra Day' },
    { id: 'other', label: 'Other Addition' },
];
const CATEGORY_LABELS: Record<string, string> = {
    ...Object.fromEntries(CATEGORIES_DEDUCTION.map(c => [c.id, c.label])),
    ...Object.fromEntries(CATEGORIES_ADDITION.map(c => [c.id, c.label])),
};

export default function PayrollAdjustmentsPage() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const canManage = [UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.AUDITOR].includes(user?.role as UserRole);

    const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

    // Staff list
    const [staffList, setStaffList] = useState<any[]>([]);
    const [staffSearch, setStaffSearch] = useState('');
    const [loadingStaff, setLoadingStaff] = useState(false);

    // Selected staff folio
    const [selectedStaff, setSelectedStaff] = useState<any>(null);
    const [folioAdjustments, setFolioAdjustments] = useState<any[]>([]);
    const [loadingFolio, setLoadingFolio] = useState(false);

    // New adjustment form (inline in folio)
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ type: 'deduction' as 'deduction' | 'addition', category: 'other', amount: '', description: '' });
    const [submitting, setSubmitting] = useState(false);
    const [updatingStatutory, setUpdatingStatutory] = useState(false);

    // Load all staff once
    useEffect(() => {
        setLoadingStaff(true);
        staffAPI.getStaff().then(res => {
            if (res.success) setStaffList(res.data || []);
        }).finally(() => setLoadingStaff(false));
    }, []);

    // Handle URL parameters for pre-filling from performance page
    useEffect(() => {
        const staffId = searchParams.get('staff_id');
        const staffName = searchParams.get('staff_name');
        const tab = searchParams.get('tab');
        const type = searchParams.get('type');
        const category = searchParams.get('category');
        const reason = searchParams.get('reason');

        if (staffId && staffList.length > 0) {
            // Find and select the staff member
            const staff = staffList.find(s => s.id === staffId);
            if (staff) {
                setSelectedStaff(staff);
                
                // Pre-fill the form if parameters are provided
                if (type && category) {
                    setForm({
                        type: type as 'deduction' | 'addition',
                        category: category,
                        amount: '',
                        description: reason || ''
                    });
                    setShowForm(true);
                    
                    // Show success toast
                    toast.success(`Ready to add ${category} for ${staffName || staff.first_name}`);
                }
            }
        }
    }, [searchParams, staffList]);

    // Load folio when staff or period changes
    const loadFolio = useCallback(async (staffId: string) => {
        setLoadingFolio(true);
        try {
            const res = await payrollAPI.getAdjustments({ staff_id: staffId, month: selectedMonth, year: selectedYear });
            setFolioAdjustments(res.success ? res.data || [] : []);
        } finally {
            setLoadingFolio(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        if (selectedStaff) loadFolio(selectedStaff.id);
    }, [selectedStaff, loadFolio]);

    const handleSelectStaff = (staff: any) => {
        setSelectedStaff(staff);
        setShowForm(false);
        setForm({ type: 'deduction', category: 'other', amount: '', description: '' });
    };

    const handleAddAdjustment = async () => {
        if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
        setSubmitting(true);
        try {
            const res = await payrollAPI.createAdjustment({
                staff_id: selectedStaff.id,
                type: form.type,
                category: form.category,
                amount: Number(form.amount),
                description: form.description,
                month: selectedMonth,
                year: Number(selectedYear),
                status: 'approved' // Auto-approve adjustments from HR module
            });
            if (res.success) {
                toast.success('Adjustment added');
                setShowForm(false);
                setForm({ type: 'deduction', category: 'other', amount: '', description: '' });
                loadFolio(selectedStaff.id);
            } else {
                toast.error(res.message || 'Failed');
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatutory = async (field: 'shif_enabled' | 'nssf_enabled' | 'uniform_enabled') => {
        if (!selectedStaff || !canManage) return;
        setUpdatingStatutory(true);
        try {
            const newValue = !selectedStaff[field];
            const res = await staffAPI.updateStaffMember(selectedStaff.id, { [field]: newValue });
            if (res.success) {
                toast.success('Enrollment updated');
                setSelectedStaff({ ...selectedStaff, [field]: newValue });
                setStaffList(prev => prev.map(s => s.id === selectedStaff.id ? { ...s, [field]: newValue } : s));
            } else {
                toast.error(res.message || 'Failed to update');
            }
        } catch (e: any) {
            toast.error('Network error');
        } finally {
            setUpdatingStatutory(false);
        }
    };

    const handleVoid = async (id: string) => {
        if (!confirm('Void this adjustment?')) return;
        const res = await payrollAPI.voidAdjustment(id);
        if (res.success) { toast.success('Voided'); loadFolio(selectedStaff.id); }
        else toast.error(res.message || 'Failed');
    };

    const filteredStaff = staffList.filter(s => {
        const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
        return name.includes(staffSearch.toLowerCase());
    });

    const folioDeductions = folioAdjustments.filter(a => a.type === 'deduction' && a.status !== 'cancelled').reduce((s, a) => s + Number(a.amount), 0);
    const folioAdditions = folioAdjustments.filter(a => a.type === 'addition' && a.status !== 'cancelled').reduce((s, a) => s + Number(a.amount), 0);
    const categories = form.type === 'deduction' ? CATEGORIES_DEDUCTION : CATEGORIES_ADDITION;

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
            <DashboardLayout>
                <div className="flex flex-col h-full gap-0 animate-ios-fade-in">

                    {/* Top bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 pb-3">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Payroll Adjustments</h1>
                            <p className="text-stone-500 text-sm">Select a staff member to open their folio</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="w-[130px] bg-white border-stone-200 rounded-xl h-9 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <SelectItem key={m} value={String(m)}>
                                            {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-[90px] bg-white border-stone-200 rounded-xl h-9 text-sm">
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

                    {/* Two-panel layout */}
                    <div className="flex flex-1 gap-4 px-4 pb-4 overflow-hidden min-h-[600px]">

                        {/* LEFT — Staff list */}
                        <div className="w-72 flex-shrink-0 flex flex-col bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                            <div className="p-3 border-b border-stone-50">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                                    <input
                                        placeholder="Search staff..."
                                        className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5"
                                        value={staffSearch}
                                        onChange={e => setStaffSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {loadingStaff ? (
                                    <div className="p-6 text-center text-stone-400 text-sm">Loading staff...</div>
                                ) : filteredStaff.length === 0 ? (
                                    <div className="p-6 text-center text-stone-400 text-sm">No staff found</div>
                                ) : filteredStaff.map(staff => {
                                    const name = `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || staff.email;
                                    const isSelected = selectedStaff?.id === staff.id;
                                    return (
                                        <button
                                            key={staff.id}
                                            onClick={() => handleSelectStaff(staff)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-stone-50 last:border-0 ${isSelected ? 'bg-stone-900 text-white' : 'hover:bg-stone-50 text-stone-900'}`}
                                        >
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'}`}>
                                                {(staff.first_name?.[0] || '?').toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-stone-900'}`}>{name}</p>
                                                <p className={`text-[10px] truncate uppercase tracking-wide ${isSelected ? 'text-white/60' : 'text-stone-400'}`}>{staff.role || staff.department || ''}</p>
                                            </div>
                                            <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 ${isSelected ? 'text-white/60' : 'text-stone-300'}`} />
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="p-3 border-t border-stone-50 text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                                {filteredStaff.length} staff
                            </div>
                        </div>

                        {/* RIGHT — Folio */}
                        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                            {!selectedStaff ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-stone-300 gap-3">
                                    <User className="h-12 w-12" />
                                    <p className="text-sm font-bold uppercase tracking-widest">Select a staff member</p>
                                </div>
                            ) : (
                                <>
                                    {/* Folio header */}
                                    <div className="p-5 border-b border-stone-50 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-stone-100 flex items-center justify-center text-lg font-bold text-stone-600">
                                                {(selectedStaff.first_name?.[0] || '?').toUpperCase()}
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold text-stone-900">
                                                    {`${selectedStaff.first_name || ''} ${selectedStaff.last_name || ''}`.trim()}
                                                </h2>
                                                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">
                                                    {selectedStaff.role || selectedStaff.department || 'Staff'} &nbsp;·&nbsp;
                                                    {new Date(0, Number(selectedMonth) - 1).toLocaleString('default', { month: 'long' })} {selectedYear}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Mini summary */}
                                            <div className="text-right hidden md:block">
                                                <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Net Adjustment</p>
                                                <p className={`text-lg font-bold ${folioAdditions - folioDeductions >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {folioAdditions - folioDeductions >= 0 ? '+' : '-'} KES {Math.abs(folioAdditions - folioDeductions).toLocaleString()}
                                                </p>
                                            </div>
                                            {canManage && (
                                                <button
                                                    onClick={() => setShowForm(v => !v)}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 ${showForm ? 'bg-stone-100 text-stone-600' : 'bg-stone-900 text-white shadow-lg shadow-stone-200'}`}
                                                >
                                                    {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                                    {showForm ? 'Cancel' : 'Add Adjustment'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Statutory Deductions Toggles */}
                                    {canManage && (
                                    <div className="px-5 py-3 border-b border-stone-50 bg-stone-50/30 flex items-center justify-between gap-4">
                                        <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest shrink-0">Statutory Deductions (Opt-In):</p>
                                        <div className="flex items-center gap-3">
                                            {[
                                                { id: 'shif_enabled', label: 'SHIF/SHA' },
                                                { id: 'nssf_enabled', label: 'NSSF' },
                                                { id: 'uniform_enabled', label: 'Uniform' }
                                            ].map(stat => {
                                                const isActive = selectedStaff[stat.id];
                                                return (
                                                    <button
                                                        key={stat.id}
                                                        disabled={updatingStatutory}
                                                        onClick={() => handleToggleStatutory(stat.id as any)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase font-bold tracking-wider transition-all border ${
                                                            isActive 
                                                                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 group' 
                                                                : 'bg-white border-stone-200 text-stone-400 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700'
                                                        }`}
                                                        title={isActive ? 'Click to Disable' : 'Click to Enable'}
                                                    >
                                                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-500 group-hover:bg-red-500' : 'bg-stone-300'}`} />
                                                        {stat.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    )}

                                    {/* Inline add form */}
                                    {showForm && (
                                        <div className="p-5 border-b border-stone-100 bg-stone-50/50">
                                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">New Adjustment</p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {/* Type toggle */}
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Type</p>
                                                    <div className="flex bg-white border border-stone-200 p-0.5 rounded-xl">
                                                        <button
                                                            onClick={() => setForm(f => ({ ...f, type: 'deduction', category: 'other' }))}
                                                            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${form.type === 'deduction' ? 'bg-red-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'}`}
                                                        >Deduction</button>
                                                        <button
                                                            onClick={() => setForm(f => ({ ...f, type: 'addition', category: 'bonus' }))}
                                                            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${form.type === 'addition' ? 'bg-emerald-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-700'}`}
                                                        >Addition</button>
                                                    </div>
                                                </div>
                                                {/* Category */}
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Category</p>
                                                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                                                        <SelectTrigger className="h-9 bg-white border-stone-200 rounded-xl text-sm">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {/* Amount */}
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Amount (KES)</p>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">KES</span>
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            value={form.amount}
                                                            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                                            className="w-full h-9 pl-10 pr-3 bg-white border border-stone-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-stone-900/5"
                                                        />
                                                    </div>
                                                </div>
                                                {/* Description */}
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Remarks</p>
                                                    <input
                                                        placeholder="Reason..."
                                                        value={form.description}
                                                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                                        className="w-full h-9 px-3 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5"
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-3 flex justify-end">
                                                <button
                                                    onClick={handleAddAdjustment}
                                                    disabled={submitting}
                                                    className="flex items-center gap-2 px-6 py-2 bg-stone-900 text-white rounded-full text-sm font-bold hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                    Save Adjustment
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Summary pills */}
                                    <div className="flex gap-3 px-5 py-3 border-b border-stone-50">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full">
                                            <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />
                                            <span className="text-xs font-bold text-red-600">- KES {folioDeductions.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full">
                                            <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />
                                            <span className="text-xs font-bold text-emerald-600">+ KES {folioAdditions.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full">
                                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                                            <span className="text-xs font-bold text-amber-600">{folioAdjustments.filter(a => a.status === 'pending').length} pending</span>
                                        </div>
                                        <button onClick={() => loadFolio(selectedStaff.id)} className="ml-auto p-1.5 text-stone-400 hover:text-stone-700 transition-colors">
                                            <RefreshCw className={`h-3.5 w-3.5 ${loadingFolio ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>

                                    {/* Adjustments list */}
                                    <div className="flex-1 overflow-y-auto">
                                        {loadingFolio ? (
                                            <div className="p-8 text-center text-stone-400 text-sm">Loading folio...</div>
                                        ) : folioAdjustments.length === 0 ? (
                                            <div className="p-12 text-center">
                                                <div className="h-12 w-12 rounded-2xl bg-stone-50 flex items-center justify-center mx-auto mb-3">
                                                    <Clock className="h-6 w-6 text-stone-300" />
                                                </div>
                                                <p className="text-stone-400 text-sm font-bold">No adjustments for this period</p>
                                                {canManage && <p className="text-stone-300 text-xs mt-1">Click "Add Adjustment" to create one</p>}
                                            </div>
                                        ) : (
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-stone-50/50 border-b border-stone-100">
                                                    <tr>
                                                        <th className="px-5 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider">Category</th>
                                                        <th className="px-5 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider">Description</th>
                                                        <th className="px-5 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider text-right">Amount</th>
                                                        <th className="px-5 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider text-center">Status</th>
                                                        <th className="px-5 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider">Date</th>
                                                        <th className="px-5 py-3" />
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-50">
                                                    {folioAdjustments
                                                        .filter(adj => adj.type === 'addition' || ALLOWED_DEDUCTION_IDS.includes(adj.category.toLowerCase()))
                                                        .map(adj => (
                                                        <tr key={adj.id} className="hover:bg-stone-50/40 transition-colors">
                                                            <td className="px-5 py-3.5">
                                                                <IOSBadge color={adj.type === 'deduction' ? 'danger' : 'success'} className="text-[10px]">
                                                                    {CATEGORY_LABELS[adj.category] || adj.category}
                                                                </IOSBadge>
                                                            </td>
                                                            <td className="px-5 py-3.5 text-stone-600 max-w-xs truncate">{adj.description || '—'}</td>
                                                            <td className="px-5 py-3.5 text-right font-bold">
                                                                <span className={adj.type === 'deduction' ? 'text-red-600' : 'text-emerald-600'}>
                                                                    {adj.type === 'deduction' ? '-' : '+'} KES {Number(adj.amount).toLocaleString()}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3.5 text-center">
                                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                                                    adj.status === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                                                    adj.status === 'applied' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                                                    adj.status === 'rejected' ? 'bg-red-50 border-red-100 text-red-600' :
                                                                    adj.status === 'pending' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                                                    'bg-stone-50 border-stone-100 text-stone-400'
                                                                }`}>{adj.status}</span>
                                                            </td>
                                                            <td className="px-5 py-3.5 text-xs text-stone-400">
                                                                {new Date(adj.created_at).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-right">
                                                                {adj.status !== 'applied' && adj.status !== 'cancelled' && canManage && (
                                                                    <button
                                                                        onClick={() => handleVoid(adj.id)}
                                                                        className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                        title="Void"
                                                                    >
                                                                        <XCircle className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
