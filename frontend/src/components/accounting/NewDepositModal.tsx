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
            const res = await accountingAPI.getAccounts({ type: 'asset' });
            // In a real app, we'd filter for 'bank' type specifically if available
            if (res.success) {
                // Filter for likely bank accounts if explicit type isn't available
                const bankAccounts = res.data.filter((acc: any) =>
                    acc.name.toLowerCase().includes('bank') ||
                    acc.account_type?.toLowerCase().includes('bank') ||
                    acc.code.startsWith('1') // Assuming asset accounts start with 1
                );
                setAccounts(bankAccounts.length > 0 ? bankAccounts : res.data);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
            // Fallback for demo/mocking if API fails
            setAccounts([
                { id: 'BA-001', name: 'Main Equity Bank', currency: 'KES' },
                { id: 'BA-002', name: 'M-Pesa Merchant', currency: 'KES' },
                { id: 'BA-003', name: 'Petty Cash', currency: 'KES' }
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
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-stone-600">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="date"
                                    className="input-field pl-9 w-full"
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
                                    className="input-field pl-9 w-full"
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
                                className="input-field pl-9 w-full appearance-none bg-transparent"
                                value={formData.bank_account_id}
                                onChange={e => setFormData({ ...formData, bank_account_id: e.target.value })}
                                required
                            >
                                <option value="">Select Account</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
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
                                className="input-field pl-9 w-full font-mono font-medium"
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

                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 btn-secondary"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 btn-primary justify-center transform active:scale-[0.98] transition-all"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
