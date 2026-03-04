'use client';

import { useState } from 'react';
import { IOSModal } from '@/components/ui/ios-modal';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSInput } from '@/components/ui/ios-input';
import { toast } from 'sonner';
import { paymentsVerificationAPI } from '@/lib/api';
import { CreditCard, DollarSign } from 'lucide-react';

interface RecordPaymentModalProps {
    onClose: () => void;
    onSuccess: () => void;
    branchId: number;
}

export function RecordPaymentModal({ onClose, onSuccess, branchId }: RecordPaymentModalProps) {
    const [formData, setFormData] = useState({
        amount: '',
        payment_method: 'cash',
        reference_number: '',
        customer_name: '',
        bill_reference: '',
        recorder_notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await paymentsVerificationAPI.createPayment({
                branch_id: branchId,
                amount: parseFloat(formData.amount),
                payment_method: formData.payment_method,
                reference_number: formData.reference_number || undefined,
                customer_name: formData.customer_name || undefined,
                bill_reference: formData.bill_reference || undefined,
                recorder_notes: formData.recorder_notes || undefined
            });

            if (response.success) {
                toast.success('Payment recorded successfully');
                onSuccess();
                onClose();
            } else {
                toast.error(response.message || 'Failed to record payment');
            }
        } catch (error: any) {
            console.error('Error recording payment:', error);
            toast.error(error.message || 'Failed to record payment');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <IOSModal
            isOpen={true}
            onClose={onClose}
            title="Record Payment"
            icon={<CreditCard className="h-6 w-6 text-blue-600" />}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount (KES) *
                    </label>
                    <IOSInput
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="0.00"
                        required
                        leftIcon={<DollarSign />}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Method *
                    </label>
                    <select
                        value={formData.payment_method}
                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    >
                        <option value="cash">Cash</option>
                        <option value="mpesa">M-Pesa</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="card">Card</option>
                        <option value="cheque">Cheque</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reference Number
                    </label>
                    <IOSInput
                        type="text"
                        value={formData.reference_number}
                        onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                        placeholder="e.g., MPESA123456"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Customer Name
                    </label>
                    <IOSInput
                        type="text"
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        placeholder="Customer name"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bill Reference
                    </label>
                    <IOSInput
                        type="text"
                        value={formData.bill_reference}
                        onChange={(e) => setFormData({ ...formData, bill_reference: e.target.value })}
                        placeholder="e.g., BILL-001"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                    </label>
                    <textarea
                        value={formData.recorder_notes}
                        onChange={(e) => setFormData({ ...formData, recorder_notes: e.target.value })}
                        placeholder="Additional notes..."
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                </div>

                <div className="flex gap-3 pt-4">
                    <IOSButton
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1"
                    >
                        Cancel
                    </IOSButton>
                    <IOSButton
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1"
                    >
                        {isSubmitting ? 'Recording...' : 'Record Payment'}
                    </IOSButton>
                </div>
            </form>
        </IOSModal>
    );
}
