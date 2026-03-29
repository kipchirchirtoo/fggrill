'use client';

import React, { useState, useEffect } from 'react';
import { kyogongAPI } from '@/lib/api/kyogong';
import { toast } from 'sonner';
import { X, Loader2, PlusCircle, MinusCircle } from 'lucide-react';

interface PettyCashModalProps {
    shift: any;
    onClose: () => void;
    onSaved: () => void;
}

const CATEGORIES = [
    { code: 'REPAIRS', name: 'Repairs' },
    { code: 'MAINTENANCE', name: 'Maintenance' },
    { code: 'FUEL', name: 'Fuel' },
    { code: 'TRANSPORT', name: 'Staff Transport' },
    { code: 'SUPPLIES', name: 'Supplies' },
    { code: 'OTHER', name: 'Other' },
];

export function PettyCashModal({ shift, onClose, onSaved }: PettyCashModalProps) {
    const [txType, setTxType] = useState<'CASH_OUT' | 'CASH_IN'>('CASH_OUT');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [paidToName, setPaidToName] = useState('');
    const [receiptNo, setReceiptNo] = useState('');
    const [authorizerName, setAuthorizerName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !category || !description) {
            toast.error('Amount, category, and description are required');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await kyogongAPI.recordPettyCash({
                shift_id: shift.id,
                amount: parseFloat(amount),
                transaction_type: txType,
                purpose_category: category,
                purpose_description: description,
                paid_to_name: paidToName || undefined,
                receipt_number: receiptNo || undefined,
                authorizer_name: authorizerName || undefined,
            });

            if (res.success) {
                toast.success('Petty cash recorded');
                onSaved();
                onClose();
            } else {
                toast.error(res.error || 'Failed to record petty cash');
            }
        } catch {
            toast.error('Error recording petty cash');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-lg font-semibold">Record Petty Cash</h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Type selector */}
                    <div className="flex rounded-lg overflow-hidden border border-gray-200">
                        <button
                            type="button"
                            onClick={() => setTxType('CASH_OUT')}
                            className={`flex-1 py-2 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${txType === 'CASH_OUT' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                            <MinusCircle className="w-4 h-4" /> Cash Out
                        </button>
                        <button
                            type="button"
                            onClick={() => setTxType('CASH_IN')}
                            className={`flex-1 py-2 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${txType === 'CASH_IN' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                            <PlusCircle className="w-4 h-4" /> Cash In
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) *</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                            className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" placeholder="0.00" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                        <select value={category} onChange={e => setCategory(e.target.value)}
                            className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" required>
                            <option value="">Select category...</option>
                            {CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                            className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" placeholder="Brief description..." required />
                    </div>

                    {txType === 'CASH_OUT' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Paid To</label>
                                <input type="text" value={paidToName} onChange={e => setPaidToName(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" placeholder="Recipient name..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Authorized By</label>
                                <input type="text" value={authorizerName} onChange={e => setAuthorizerName(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" placeholder="Authorizer name..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt No.</label>
                                <input type="text" value={receiptNo} onChange={e => setReceiptNo(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500" placeholder="Receipt number..." />
                            </div>
                        </>
                    )}

                    <button type="submit" disabled={isSubmitting}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Record Entry'}
                    </button>
                </form>
            </div>
        </div>
    );
}
