'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    X,
    Wallet,
    DollarSign,
    FileText,
    Tag,
    Calendar,
    Loader2,
    Plus
} from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { pettyCashAPI } from '@/lib/api';
import { useBranch } from '@/hooks/useBranch';

interface PettyCashModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CATEGORIES = [
    'Utilities',
    'Maintenance',
    'Food Supplies',
    'Beverages',
    'Transport',
    'Kitchen Petty',
    'Office Stationery',
    'Cleaning Supplies',
    'Other'
];

export const PettyCashModal = ({ isOpen, onClose, onSuccess }: PettyCashModalProps) => {
    const { activeBranchId } = useBranch();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeBranchId) {
            toast.error('No active branch selected');
            return;
        }

        setLoading(true);
        try {
            const res = await pettyCashAPI.request({
                ...formData,
                amount: Number(formData.amount),
                branch_id: activeBranchId
            });

            if (res.success) {
                toast.success('Petty cash request submitted');
                onSuccess();
                onClose();
                setFormData({ amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0] });
            } else {
                toast.error(res.error || 'Failed to submit request');
            }
        } catch (error: any) {
            toast.error(error.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-stone-50 rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden"
            >
                <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <Wallet className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900">Petty Cash Request</h2>
                            <p className="text-xs text-stone-500">Request funds for branch operational expenses</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5 text-stone-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-xs font-medium text-stone-500 mb-1 block">Amount (KES)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <Input
                                    required
                                    type="number"
                                    min="1"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                                    className="bg-white border-stone-200 rounded-xl pl-9 text-lg font-bold text-stone-900"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-stone-500 mb-1 block">Category</label>
                            <select
                                required
                                value={formData.category}
                                onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                                className="w-full bg-white border border-stone-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            >
                                <option value="">Select Category</option>
                                {CATEGORIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-stone-500 mb-1 block">Date</label>
                            <Input
                                required
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                                className="bg-white border-stone-200 rounded-xl"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-stone-500 mb-1 block">Description / Purpose</label>
                        <textarea
                            required
                            rows={4}
                            placeholder="Explain why these funds are needed..."
                            value={formData.description}
                            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                            className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <IOSButton
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            className="flex-1 rounded-2xl py-6"
                        >
                            Cancel
                        </IOSButton>
                        <IOSButton
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl py-6"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="h-5 w-5 mr-2" />
                                    Submit Request
                                </>
                            )}
                        </IOSButton>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
