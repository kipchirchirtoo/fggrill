'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { IOSButton } from '@/components/ui/ios-button';
import { barAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Coins, CreditCard, Banknote, Smartphone } from 'lucide-react';

interface PoolTokenModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId?: number;
    onSuccess?: () => void;
}

export function PoolTokenModal({ isOpen, onClose, branchId, onSuccess }: PoolTokenModalProps) {
    const [quantity, setQuantity] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card' | 'room_charge'>('cash');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notes, setNotes] = useState('');

    const pricePerToken = 100;
    const totalAmount = quantity * pricePerToken;

    const handleSubmit = async () => {
        if (quantity <= 0) {
            toast.error('Quantity must be greater than 0');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await barAPI.recordPoolTokens({
                tokens_sold: quantity,
                amount: totalAmount,
                branch_id: branchId,
                // The API type doesn't include payment_method yet, but the backend accepts it in req.body
                ...({ payment_method: paymentMethod, notes } as any)
            });

            if (response.success) {
                toast.success('Token sales recorded and submitted for audit');
                onClose();
                if (onSuccess) onSuccess();
            } else {
                throw new Error(response.message || 'Failed to record sales');
            }
        } catch (error: any) {
            toast.error(error.message || 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-indigo-500" />
                        Pool Table Token Sales
                    </DialogTitle>
                    <p className="text-xs text-stone-500">Record tokens issued and collect payment</p>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Number of Tokens</label>
                        <div className="flex items-center gap-4">
                            <Input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                className="text-2xl font-bold h-14 text-center"
                                min="1"
                            />
                            <div className="text-right flex-1">
                                <p className="text-xs text-stone-400">Total Amount</p>
                                <p className="text-xl font-bold text-indigo-600">KES {totalAmount.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Payment Method</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'cash', label: 'Cash', icon: Banknote, color: 'emerald' },
                                { id: 'mpesa', label: 'M-Pesa', icon: Smartphone, color: 'green' },
                                { id: 'card', label: 'Card', icon: CreditCard, color: 'blue' },
                                { id: 'room_charge', label: 'Room Charge', icon: Banknote, color: 'indigo' },
                            ].map((method) => {
                                const Icon = method.icon;
                                const active = paymentMethod === method.id;
                                return (
                                    <button
                                        key={method.id}
                                        onClick={() => setPaymentMethod(method.id as any)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${active
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                                            : 'border-stone-100 bg-stone-50 text-stone-600 hover:bg-stone-100'
                                            }`}
                                    >
                                        <Icon className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-stone-400'}`} />
                                        <span className="text-xs font-bold">{method.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Notes (Optional)</label>
                        <Input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Table number or specific instructions"
                            className="bg-stone-50 border-stone-100"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <IOSButton variant="secondary" onClick={onClose} className="flex-1">Cancel</IOSButton>
                        <IOSButton onClick={handleSubmit} loading={isSubmitting} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                            Submit Sales
                        </IOSButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
