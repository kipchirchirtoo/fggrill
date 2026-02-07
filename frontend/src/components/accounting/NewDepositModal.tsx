'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, FileText, Landmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { accountingAPI } from '@/lib/api';

interface NewDepositModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    branchId: number;
}

export function NewDepositModal({ isOpen, onClose, onSuccess, branchId }: NewDepositModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        deposit_date: new Date().toISOString().split('T')[0],
        reference: '',
        bank_account_id: '',
        amount: '',
        description: '',
        notes: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchAccounts();
        }
    }, [isOpen]);

    const fetchAccounts = async () => {
        try {
            const res = await accountingAPI.getBankAccounts({ branch_id: branchId });

            if (res.success && res.data) {
                setAccounts(res.data);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
            // Fallback for demo/mocking if API fails
            setAccounts([
                { id: 'BA-001', bank_name: 'Main Equity Bank', currency: 'KES', account_number: '1234567890' },
                { id: 'BA-002', bank_name: 'M-Pesa Merchant', currency: 'KES', account_number: '9876543210' },
                { id: 'BA-003', bank_name: 'Petty Cash', currency: 'KES', account_number: 'N/A' }
            ]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.bank_account_id || !formData.amount || !formData.reference) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                branch_id: branchId,
                ...formData,
                amount: parseFloat(formData.amount),
                type: 'deposit'
            };

            const res = await accountingAPI.createDeposit(payload);

            if (res.success) {
                toast.success('Deposit recorded successfully');
                setFormData({
                    deposit_date: new Date().toISOString().split('T')[0],
                    reference: '',
                    bank_account_id: '',
                    amount: '',
                    description: '',
                    notes: ''
                });
                onSuccess();
                onClose();
            } else {
                toast.error(res.message || 'Failed to record deposit');
            }
        } catch (error) {
            console.error('Error creating deposit:', error);
            toast.error('An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-stone-100">
                    <div>
                        <h2 className="text-lg font-bold text-stone-900">New Deposit</h2>
                        <p className="text-xs text-stone-500">Record a bank deposit or transfer</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                    >
                        <X className="h-4 w-4 text-stone-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-5 space-y-5 overflow-y-auto scrollbar-thin">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-stone-600">Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <input
                                        type="date"
                                        className="input-field pl-10 w-full"
                                        value={formData.deposit_date}
                                        onChange={e => setFormData({ ...formData, deposit_date: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-stone-600">Reference</label>
                                <div className="relative">
                                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <input
                                        type="text"
                                        placeholder="e.g. DEP-001"
                                        className="input-field !pl-16 w-full"
                                        value={formData.reference}
                                        onChange={e => setFormData({ ...formData, reference: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-stone-600">Bank Account</label>
                            <div className="relative">
                                <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <select
                                    className="input-field !pl-16 w-full appearance-none bg-transparent"
                                    value={formData.bank_account_id}
                                    onChange={e => setFormData({ ...formData, bank_account_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select Account</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.bank_name} - {acc.account_number} ({acc.currency})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-stone-600">Amount</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="input-field !pl-16 w-full font-mono font-medium"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-stone-600">Description</label>
                            <input
                                type="text"
                                placeholder="Brief description of the deposit"
                                className="input-field w-full"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-stone-600">Notes (Optional)</label>
                            <textarea
                                rows={2}
                                placeholder="Additional details..."
                                className="input-field w-full py-2"
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>

                    </div>

                    <div className="p-4 bg-stone-50/50 border-t border-stone-100 flex gap-3 sticky bottom-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-[14px] bg-stone-100 text-stone-600 hover:bg-stone-200 transition-all"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-[14px] bg-stone-900 text-white hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-sm transform active:scale-[0.98]"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Record Deposit'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
