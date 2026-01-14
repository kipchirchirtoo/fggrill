import React, { useState } from 'react';
import {
    X, Receipt, User, Building2, Calendar,
    DollarSign, FileText, Plus, Hash, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IOSButton } from '../ui/ios-button';
import { IOSCard } from '../ui/ios-card';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { cashierAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';
import { useAuth } from '@/lib/auth-context';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const CreateDynamicBillModal = ({ isOpen, onClose, onSuccess }: ModalProps) => {
    const { activeBranchId } = useBranch();
    const [isLoading, setIsLoading] = useState(false);

    // Initial state for easy resetting
    const initialFormData = {
        customer_name: '',
        room_number: '',
        bill_type: 'Conference',
        total_amount: '',
        remarks: '',
        due_date: new Date().toISOString().split('T')[0]
    };

    const [formData, setFormData] = useState(initialFormData);

    const revenueStreams = [
        { id: 'Conference', label: 'Conference / Hall' },
        { id: 'Pool', label: 'Swimming Pool' },
        { id: 'CarWash', label: 'Car Wash' },
        { id: 'Laundry', label: 'Laundry Service' },
        { id: 'Other', label: 'Other Services' }
    ];

    // Handle form reset when modal closes
    React.useEffect(() => {
        if (!isOpen) {
            setFormData(initialFormData);
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.customer_name || !formData.total_amount) {
            toast.error('Please fill in required fields');
            return;
        }

        if (!activeBranchId) {
            toast.error('No active branch selected');
            return;
        }

        setIsLoading(true);
        try {
            const res = await cashierAPI.createUnpaidBill({
                ...formData,
                branch_id: activeBranchId,
                total_amount: parseFloat(formData.total_amount),
                customer_type: 'walk_in',
            });

            if (res.success) {
                toast.success('Bill created successfully');
                onSuccess?.();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to create bill');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                className="absolute inset-0 bg-stone-900/60 backdrop-blur-[2px]"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden z-10"
            >
                {/* Header */}
                <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 rounded-2xl">
                            <Receipt className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900">Create Dynamic Bill</h2>
                            <p className="text-sm text-stone-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Generate an unpaid bill for services</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="p-2 hover:bg-stone-200 rounded-full transition-colors group"
                    >
                        <X className="h-5 w-5 text-stone-400 group-hover:text-stone-600" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-5">
                        {/* Service Type Selection */}
                        <div className="space-y-3">
                            <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Service Type</label>
                            <div className="grid grid-cols-2 gap-2.5">
                                {revenueStreams.map((stream) => (
                                    <button
                                        key={stream.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, bill_type: stream.id })}
                                        className={`px-4 py-2.5 rounded-2xl text-xs font-bold border-2 transition-all flex items-center justify-center text-center
                                            ${formData.bill_type === stream.id
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-200/50'
                                                : 'border-stone-100 bg-white text-stone-500 hover:border-stone-200 active:scale-95'}`}
                                    >
                                        {stream.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            {/* Customer Name */}
                            <div className="col-span-2 sm:col-span-1 space-y-2.5">
                                <label htmlFor="customer_name" className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Customer Name</label>
                                <div className="relative group">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 group-focus-within:text-emerald-500 transition-colors" />
                                    <Input
                                        id="customer_name"
                                        name="customer_name"
                                        required
                                        placeholder="Guest Name"
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                        className="pl-10 h-12 bg-stone-50/50 border-stone-100 hover:border-stone-200 focus:bg-white focus:border-emerald-500 transition-all rounded-[16px]"
                                    />
                                </div>
                            </div>

                            {/* Room Number */}
                            <div className="col-span-2 sm:col-span-1 space-y-2.5">
                                <label htmlFor="room_number" className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Room Number (Opt)</label>
                                <div className="relative group">
                                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 group-focus-within:text-emerald-500 transition-colors" />
                                    <Input
                                        id="room_number"
                                        name="room_number"
                                        placeholder="Room #"
                                        value={formData.room_number}
                                        onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                                        className="pl-10 h-12 bg-stone-50/50 border-stone-100 hover:border-stone-200 focus:bg-white focus:border-emerald-500 transition-all rounded-[16px]"
                                    />
                                </div>
                            </div>

                            {/* Total Amount */}
                            <div className="col-span-2 sm:col-span-1 space-y-2.5">
                                <label htmlFor="total_amount" className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Total Amount (KES)</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-500 group-focus-within:text-emerald-600 transition-colors" />
                                    <Input
                                        id="total_amount"
                                        name="total_amount"
                                        required
                                        type="number"
                                        placeholder="0.00"
                                        value={formData.total_amount}
                                        onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                                        className="pl-10 h-12 bg-emerald-50/30 border-emerald-100 hover:border-emerald-200 focus:bg-white focus:border-emerald-500 transition-all rounded-[16px] font-bold text-emerald-700"
                                    />
                                </div>
                            </div>

                            {/* Due Date */}
                            <div className="col-span-2 sm:col-span-1 space-y-2.5">
                                <label htmlFor="due_date" className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Due Date</label>
                                <div className="relative group">
                                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 group-focus-within:text-emerald-500 transition-colors" />
                                    <Input
                                        id="due_date"
                                        name="due_date"
                                        type="date"
                                        value={formData.due_date}
                                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                        className="pl-10 h-12 bg-stone-50/50 border-stone-100 hover:border-stone-200 focus:bg-white focus:border-emerald-500 transition-all rounded-[16px]"
                                    />
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="col-span-2 space-y-2.5">
                                <label htmlFor="remarks" className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Remarks</label>
                                <div className="relative group">
                                    <FileText className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400 group-focus-within:text-emerald-500 transition-colors" />
                                    <textarea
                                        id="remarks"
                                        name="remarks"
                                        rows={3}
                                        placeholder="Additional details about this bill..."
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        className="w-full pl-10 pr-4 py-3 bg-stone-50/50 border border-stone-100 rounded-[16px] text-sm focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all resize-none group-hover:border-stone-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 pt-4 border-t border-stone-100">
                        <IOSButton
                            type="button"
                            variant="outline"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            className="flex-1 h-13 rounded-2xl font-bold border-stone-200 text-stone-600 hover:bg-stone-50"
                        >
                            Cancel
                        </IOSButton>
                        <IOSButton
                            type="submit"
                            loading={isLoading}
                            className="flex-[1.5] h-13 bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] rounded-2xl shadow-xl shadow-emerald-500/20 text-base font-bold transition-all"
                        >
                            Create & Print Bill
                        </IOSButton>
                    </div>
                </form>
            </motion.div>
        </div>
    );

};

export const BillDetailsModal = ({
    isOpen, onClose, onSuccess, bill, type = 'unpaid'
}: ModalProps & { bill: any; type?: 'unpaid' | 'credit' }) => {
    const { user } = useAuth() as any;
    const [isConfirming, setIsConfirming] = useState(false);

    if (!isOpen || !bill) return null;

    const handleConfirm = async (role: 'accountant' | 'auditor') => {
        setIsConfirming(true);
        try {
            const res = type === 'credit'
                ? await cashierAPI.confirmCreditBill(bill.id, role)
                : await cashierAPI.confirmUnpaidBill(bill.id, role);

            if (res.success) {
                toast.success(`Bill confirmed by ${role}`);
                onSuccess?.();
            }
        } catch (error: any) {
            toast.error(error.message || 'Confirmation failed');
        } finally {
            setIsConfirming(false);
        }
    };

    const isAccountant = ['super_admin', 'branch_manager', 'accountant', 'branch_accountant'].includes(user?.role);
    const isAuditor = ['super_admin', 'auditor'].includes(user?.role);

    const billNumber = bill.bill_number || bill.credit_number;
    const amount = bill.total_amount || bill.grand_total;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    // ... (animation props)
                    className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
                >
                    {/* ... header ... */}

                    <div className="p-5 space-y-6">
                        {/* ... details grid ... */}
                        <div className="grid grid-cols-2 gap-6">
                            {/* ... */}
                        </div>

                        <div className="p-4 bg-stone-50 rounded-2xl space-y-3">
                            <h4 className="text-xs font-bold text-stone-400 uppercase">Confirmation Status</h4>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1 rounded-full ${bill.accountant_confirmed_at ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-200 text-stone-400'}`}>
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium">Accountant</span>
                                </div>
                                {bill.accountant_confirmed_at ? (
                                    <span className="text-xs text-stone-400">{new Date(bill.accountant_confirmed_at).toLocaleDateString()}</span>
                                ) : (
                                    isAccountant && (
                                        <IOSButton size="sm" onClick={() => handleConfirm('accountant')} loading={isConfirming}>Confirm</IOSButton>
                                    )
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1 rounded-full ${bill.auditor_confirmed_at ? 'bg-blue-100 text-blue-600' : 'bg-stone-200 text-stone-400'}`}>
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium">Auditor</span>
                                </div>
                                {bill.auditor_confirmed_at ? (
                                    <span className="text-xs text-stone-400">{new Date(bill.auditor_confirmed_at).toLocaleDateString()}</span>
                                ) : (
                                    isAuditor && (
                                        // Auditor can only verify if Accountant has confirmed
                                        <IOSButton
                                            size="sm"
                                            onClick={() => handleConfirm('auditor')}
                                            loading={isConfirming}
                                            disabled={!bill.accountant_confirmed_at}
                                            className={!bill.accountant_confirmed_at ? 'opacity-50 cursor-not-allowed' : ''}
                                        >
                                            Verify
                                        </IOSButton>
                                    )
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <IOSButton variant="ghost" onClick={onClose} className="flex-1">Close</IOSButton>
                            <IOSButton className="flex-1">Print Copy</IOSButton>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export const CashierModals = {
    CreateDynamicBillModal,
    BillDetailsModal
};
