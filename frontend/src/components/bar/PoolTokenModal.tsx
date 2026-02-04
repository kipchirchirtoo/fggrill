'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { IOSButton } from '@/components/ui/ios-button';
import { barAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Coins, CreditCard, Banknote, Smartphone, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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

    const pricePerToken = 50;
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
            <DialogContent className="max-w-xl">
                <DialogHeader className="border-b border-stone-100 pb-4">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Coins className="h-6 w-6 text-indigo-500" />
                        Pool Table Token Sales
                    </DialogTitle>
                    <p className="text-sm text-stone-500">Record tokens issued and collect payment</p>
                </DialogHeader>

                <DialogBody className="p-0">
                    <ScrollArea className="max-h-[60vh] p-6">
                        <div className="space-y-8">
                            {/* Quantity Section */}
                            <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
                                <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest mb-4 block">Token Configuration</label>
                                <div className="flex flex-col md:flex-row md:items-center gap-6">
                                    <div className="flex-1 space-y-2">
                                        <p className="text-sm font-bold text-stone-700">Number of Tokens</p>
                                        <Input
                                            type="number"
                                            value={quantity}
                                            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                            className="text-3xl font-black h-16 text-center bg-white border-2 border-stone-200 focus:border-indigo-500 transition-colors"
                                            min="1"
                                        />
                                    </div>
                                    <div className="w-px h-12 bg-stone-200 hidden md:block" />
                                    <div className="flex-1 text-center md:text-right">
                                        <p className="text-xs font-bold text-stone-400 uppercase">Total Payable</p>
                                        <p className="text-4xl font-black text-indigo-600 tracking-tight">
                                            <span className="text-base font-bold mr-1">KES</span>
                                            {totalAmount.toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-stone-400 mt-1">@ KES {pricePerToken} per token</p>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method Section */}
                            <div className="space-y-4">
                                <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest block">Payment Method</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { id: 'cash', label: 'Cash', icon: Banknote },
                                        { id: 'mpesa', label: 'M-Pesa', icon: Smartphone },
                                        { id: 'card', label: 'Card', icon: CreditCard },
                                        { id: 'room_charge', label: 'Room Charge', icon: Info },
                                    ].map((method) => {
                                        const Icon = method.icon;
                                        const active = paymentMethod === method.id;
                                        return (
                                            <button
                                                key={method.id}
                                                onClick={() => setPaymentMethod(method.id as any)}
                                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all group ${active
                                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md ring-4 ring-indigo-50/50'
                                                    : 'border-stone-100 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                                                    }`}
                                            >
                                                <div className={`p-2 rounded-xl transition-colors ${active ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-400 group-hover:bg-stone-200'}`}>
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <span className="text-[11px] font-black uppercase tracking-tight">{method.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Notes Section */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest block">Audit Notes (Optional)</label>
                                <Input
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="e.g. Table number, customer name, or internal reference"
                                    className="h-12 bg-white border-stone-200 focus:bg-white text-sm"
                                />
                            </div>
                        </div>
                    </ScrollArea>
                </DialogBody>

                <DialogFooter className="bg-stone-50 border-t border-stone-100 p-6 flex gap-3">
                    <IOSButton variant="secondary" onClick={onClose} className="flex-1 h-12 text-sm font-bold">
                        Cancel
                    </IOSButton>
                    <IOSButton
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-sm font-black shadow-lg shadow-indigo-100"
                    >
                        Confirm & Record Sale
                    </IOSButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
