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
    const [formData, setFormData] = useState({
        customer_name: '',
        room_number: '',
        bill_type: 'Conference', // Default
        total_amount: '',
        remarks: '',
        due_date: new Date().toISOString().split('T')[0]
    });

    const revenueStreams = [
        { id: 'Conference', label: 'Conference / Hall', prefix: 'CON' },
        { id: 'Pool', label: 'Swimming Pool', prefix: 'POL' },
        { id: 'CarWash', label: 'Car Wash', prefix: 'CWS' },
        { id: 'Laundry', label: 'Laundry Service', prefix: 'LND' },
        { id: 'Other', label: 'Other Services', prefix: 'BILL' }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customer_name || !formData.total_amount) {
            toast.error('Please fill in required fields');
            return;
        }

        setIsLoading(true);
        try {
            const res = await cashierAPI.createUnpaidBill({
                ...formData,
                branch_id: activeBranchId,
                total_amount: parseFloat(formData.total_amount),
                customer_type: 'walk_in',
                bill_type: formData.bill_type,
            });

            if (res.success) {
                toast.success('Bill created successfully');
                onSuccess?.();
                onClose();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to create bill');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
                />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
                >
                    <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-xl">
                                <Plus className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-stone-900">Create Dynamic Bill</h2>
                                <p className="text-sm text-stone-500">Generate an unpaid bill for services</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                            <X className="h-5 w-5 text-stone-400" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-bold text-stone-400 uppercase ml-1">Service Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {revenueStreams.map((stream) => (
                                        <button
                                            key={stream.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, bill_type: stream.id })}
                                            className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all
                        ${formData.bill_type === stream.id
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                    : 'border-stone-100 bg-white text-stone-500 hover:border-stone-200'}`}
                                        >
                                            {stream.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-400 uppercase ml-1">Customer Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <Input
                                        required
                                        placeholder="Guest Name"
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                        className="pl-9 h-11 bg-stone-50 border-none rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-400 uppercase ml-1">Room Number (Opt)</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <Input
                                        placeholder="Room #"
                                        value={formData.room_number}
                                        onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                                        className="pl-9 h-11 bg-stone-50 border-none rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-400 uppercase ml-1">Total Amount (KES)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <Input
                                        required
                                        type="number"
                                        placeholder="0.00"
                                        value={formData.total_amount}
                                        onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                                        className="pl-9 h-11 bg-stone-50 border-none rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-400 uppercase ml-1">Due Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <Input
                                        type="date"
                                        value={formData.due_date}
                                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                        className="pl-9 h-11 bg-stone-50 border-none rounded-xl"
                                    />
                                </div>
                            </div>

                            <div className="col-span-2 space-y-2">
                                <label className="text-xs font-bold text-stone-400 uppercase ml-1">Remarks</label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                                    <textarea
                                        rows={3}
                                        placeholder="Additional details..."
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        className="w-full pl-9 p-3 bg-stone-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <IOSButton
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                className="flex-1 h-12 rounded-2xl"
                            >
                                Cancel
                            </IOSButton>
                            <IOSButton
                                type="submit"
                                isLoading={isLoading}
                                className="flex-[2] h-12 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl shadow-lg shadow-emerald-500/20 text-base font-bold"
                            >
                                Create & Print Bill
                            </IOSButton>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
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

                    <div className="p-6 space-y-6">
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
                                        <IOSButton size="sm" onClick={() => handleConfirm('accountant')} isLoading={isConfirming}>Confirm</IOSButton>
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
                                            isLoading={isConfirming}
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
