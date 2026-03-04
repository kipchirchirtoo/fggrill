'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import { IOSButton } from '@/components/ui/ios-button';
import { X } from 'lucide-react';
import { bankingAPI } from '@/lib/api';
import { toast } from 'sonner';

interface RecordTransactionModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export function RecordTransactionModal({ onClose, onSuccess }: RecordTransactionModalProps) {
    const { activeBranchId } = useBranch();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_type: 'DEPOSIT',
        bank_name: '',
        account_number: '',
        amount: '',
        currency: 'KES',
        reference_number: '',
        source: '',
        destination: '',
        payment_method: 'CASH',
        receipt_number: '',
        slip_attachment_url: '',
        purpose_category: 'DAILY_SALES',
        purpose_description: '',
        notes: ''
    });

    useEffect(() => {
        loadBankAccounts();
    }, [activeBranchId]);

    const loadBankAccounts = async () => {
        try {
            const res = await bankingAPI.getBankAccounts({ 
                branch_id: activeBranchId || undefined 
            });
            if (res.success) {
                setBankAccounts(res.data || []);
            }
        } catch (error) {
            console.error('Error loading bank accounts:', error);
        }
    };

    const handleBankAccountChange = (accountId: string) => {
        const account = bankAccounts.find(acc => acc.id === parseInt(accountId));
        if (account) {
            setFormData(prev => ({
                ...prev,
                bank_name: account.bank_name,
                account_number: account.account_number
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.transaction_date || !formData.transaction_type || !formData.bank_name || 
            !formData.account_number || !formData.amount || !formData.reference_number || 
            !formData.purpose_description) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await bankingAPI.recordBankingTransaction({
                transaction_date: formData.transaction_date,
                transaction_type: formData.transaction_type as 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'BANK_CHARGE',
                bank_name: formData.bank_name,
                account_number: formData.account_number,
                amount: parseFloat(formData.amount),
                currency: formData.currency,
                reference_number: formData.reference_number,
                source: formData.source || undefined,
                destination: formData.destination || undefined,
                payment_method: formData.payment_method as 'CASH' | 'CHEQUE' | 'MPESA' | 'BANK_TRANSFER' | 'CARD' | undefined,
                receipt_number: formData.receipt_number || undefined,
                slip_attachment_url: formData.slip_attachment_url || undefined,
                purpose_category: formData.purpose_category as 'TRANSFER' | 'DAILY_SALES' | 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT' | 'EXPENSE' | 'OTHER' | undefined,
                purpose_description: formData.purpose_description,
                notes: formData.notes || undefined,
                branch_id: activeBranchId || undefined
            });

            if (res.success) {
                toast.success('Banking transaction recorded successfully');
                onSuccess();
            } else {
                toast.error(res.message || 'Failed to record transaction');
            }
        } catch (error) {
            console.error('Error recording transaction:', error);
            toast.error('Error recording transaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Record Banking Transaction</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Transaction Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Transaction Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={formData.transaction_date}
                            onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Transaction Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Transaction Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={formData.transaction_type}
                            onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        >
                            <option value="DEPOSIT">Deposit</option>
                            <option value="WITHDRAWAL">Withdrawal</option>
                            <option value="TRANSFER">Transfer</option>
                            <option value="BANK_CHARGE">Bank Charge</option>
                        </select>
                    </div>

                    {/* Bank Account Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Bank Account <span className="text-red-500">*</span>
                        </label>
                        <select
                            onChange={(e) => handleBankAccountChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        >
                            <option value="">Select bank account</option>
                            {bankAccounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.bank_name} - {account.account_number} ({account.account_name})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Amount (KES) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                            required
                        />
                    </div>

                    {/* Reference Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reference Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.reference_number}
                            onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., DEP-20260303-001"
                            required
                        />
                    </div>

                    {/* Payment Method */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Payment Method
                        </label>
                        <select
                            value={formData.payment_method}
                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="CASH">Cash</option>
                            <option value="CHEQUE">Cheque</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="MPESA">M-Pesa</option>
                            <option value="CARD">Card</option>
                        </select>
                    </div>

                    {/* Source (for deposits) */}
                    {formData.transaction_type === 'DEPOSIT' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Source
                            </label>
                            <input
                                type="text"
                                value={formData.source}
                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., Daily Cash Sales"
                            />
                        </div>
                    )}

                    {/* Destination (for withdrawals) */}
                    {formData.transaction_type === 'WITHDRAWAL' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Destination
                            </label>
                            <input
                                type="text"
                                value={formData.destination}
                                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., Supplier Payment"
                            />
                        </div>
                    )}

                    {/* Purpose Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Purpose Category
                        </label>
                        <select
                            value={formData.purpose_category}
                            onChange={(e) => setFormData({ ...formData, purpose_category: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="DAILY_SALES">Daily Sales</option>
                            <option value="CUSTOMER_PAYMENT">Customer Payment</option>
                            <option value="SUPPLIER_PAYMENT">Supplier Payment</option>
                            <option value="EXPENSE">Expense</option>
                            <option value="TRANSFER">Transfer</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>

                    {/* Purpose Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Purpose Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.purpose_description}
                            onChange={(e) => setFormData({ ...formData, purpose_description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                            placeholder="Describe the purpose of this transaction"
                            required
                        />
                    </div>

                    {/* Receipt Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Receipt Number
                        </label>
                        <input
                            type="text"
                            value={formData.receipt_number}
                            onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Optional"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                            placeholder="Additional notes (optional)"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <IOSButton
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancel
                        </IOSButton>
                        <IOSButton
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1"
                        >
                            {isSubmitting ? 'Recording...' : 'Record Transaction'}
                        </IOSButton>
                    </div>
                </form>
            </div>
        </div>
    );
}
