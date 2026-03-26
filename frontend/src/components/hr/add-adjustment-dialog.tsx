'use client';

import { useState, useEffect } from 'react';
import { staffAPI, payrollAPI } from '@/lib/api';
import { Plus, RefreshCw, User, DollarSign, Calendar, FileText, ChevronDown, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IOSButton } from '@/components/ui/ios-button';

interface StaffMember {
    id: string;
    first_name: string;
    last_name: string;
}

interface AddAdjustmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    initialStaffId?: string;
}

export function AddAdjustmentDialog({ open, onOpenChange, onSuccess, initialStaffId }: AddAdjustmentDialogProps) {
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        staff_id: '',
        type: 'addition' as 'addition' | 'deduction',
        category: 'bonus' as any,
        amount: '',
        description: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
    });

    useEffect(() => {
        if (open) {
            fetchStaff();
            if (initialStaffId) {
                setFormData(prev => ({ ...prev, staff_id: initialStaffId }));
            }
        }
    }, [open, initialStaffId]);

    const fetchStaff = async () => {
        try {
            const res = await staffAPI.getStaff({ limit: 1000 });
            if (res.success) setStaffList(res.data || []);
        } catch (e) {
            console.error('Error fetching staff:', e);
        }
    };

    const handleSubmit = async () => {
        if (!formData.staff_id || !formData.amount) {
            toast.error('Please fill in required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await payrollAPI.createAdjustment({
                ...formData,
                amount: Number(formData.amount),
                month: String(formData.month),
                year: Number(formData.year)
            });

            if (res.success) {
                toast.success('Adjustment created');
                onSuccess();
                onOpenChange(false);
                setFormData({
                    staff_id: '',
                    type: 'addition',
                    category: 'bonus',
                    amount: '',
                    description: '',
                    month: new Date().getMonth() + 1,
                    year: new Date().getFullYear(),
                });
            } else {
                toast.error(res.message || 'Failed to create adjustment');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const categories = formData.type === 'addition'
        ? [
            { id: 'bonus', label: 'Performance Bonus' },
            { id: 'overtime', label: 'Overtime Payment' },
            { id: 'allowance', label: 'Travel/Fuel Allowance' },
            { id: 'other', label: 'Other Addition' },
        ]
        : [
            { id: 'credit_bills', label: 'Credit Bills' },
            { id: 'absenteeism', label: 'Absenteeism Deduction' },
            { id: 'loan', label: 'Loans' },
            { id: 'advance', label: 'Advances' },
            { id: 'shif', label: 'SHIF' },
            { id: 'nssf', label: 'NSSF' },
            { id: 'uniform', label: 'Uniform' },
            { id: 'other', label: 'Other Deductions' },
        ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-[32px] bg-white animate-ios-slide-in">
                <div className="p-8 pb-0">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center">
                            <Plus className="w-6 h-6 text-stone-900" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-bold tracking-tight text-stone-900">New Adjustment</DialogTitle>
                            <p className="text-stone-400 text-sm font-medium mt-0.5 tracking-tight">Add addition or deduction to payroll</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-4 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar no-scrollbar">
                    {/* Staff Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Staff Member</label>
                        <Select
                            value={formData.staff_id}
                            onValueChange={(val) => setFormData({ ...formData, staff_id: val })}
                            disabled={!!initialStaffId}
                        >
                            <SelectTrigger className="h-12 bg-stone-50 border-stone-200 rounded-xl font-medium focus:ring-stone-900/5">
                                <SelectValue placeholder="Search and select staff..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-stone-200">
                                {staffList.map((staff) => (
                                    <SelectItem key={staff.id} value={staff.id} className="rounded-lg">
                                        {staff.first_name} {staff.last_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Type */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Type</label>
                            <div className="flex bg-stone-50 p-1 rounded-xl border border-stone-200">
                                <button
                                    onClick={() => setFormData({ ...formData, type: 'addition', category: 'bonus' })}
                                    className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${formData.type === 'addition' ? 'bg-white text-stone-900 shadow-sm border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}
                                >
                                    Addition
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, type: 'deduction', category: 'nssf' })}
                                    className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${formData.type === 'deduction' ? 'bg-white text-stone-900 shadow-sm border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}
                                >
                                    Deduction
                                </button>
                            </div>
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Category</label>
                            <Select
                                value={formData.category}
                                onValueChange={(val) => setFormData({ ...formData, category: val as any })}
                            >
                                <SelectTrigger className="h-10 bg-stone-50 border-stone-200 rounded-xl font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-stone-200">
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id} className="rounded-lg">{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Month */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Period Month</label>
                            <Select
                                value={String(formData.month)}
                                onValueChange={(val) => setFormData({ ...formData, month: Number(val) })}
                            >
                                <SelectTrigger className="h-12 bg-stone-50 border-stone-200 rounded-xl font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <SelectItem key={m} value={String(m)}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Amount */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Amount (KES)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">KES</span>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full h-12 pl-14 pr-4 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Justification / Remarks</label>
                        <textarea
                            placeholder="Reason for this adjustment..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all min-h-[100px] shadow-sm resize-none"
                        />
                    </div>

                    <div className="pt-2">
                        <IOSButton
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full h-14 bg-[#007AFF] text-white shadow-xl shadow-blue-100 hover:bg-[#0062CC] border-none"
                        >
                            {isSubmitting ? (
                                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                                <CheckCircle2 className="h-5 w-5 mr-2" />
                            )}
                            <span className="text-lg font-bold">Process Adjustment</span>
                        </IOSButton>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="w-full mt-4 py-2 text-stone-400 text-[13px] font-bold hover:text-stone-900 transition-colors uppercase tracking-widest"
                        >
                            Refuse / Cancel
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
