'use client';

import { useState } from 'react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { accountingAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';

interface CreateInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'conference' | 'guest' | 'general' | null;
    onSuccess: () => void;
}

export function CreateInvoiceModal({ isOpen, onClose, type, onSuccess }: CreateInvoiceModalProps) {
    const { activeBranchId } = useBranch();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: '',
        reference: '',
        notes: ''
    });

    const [items, setItems] = useState<{ description: string; quantity: number; unitPrice: number }[]>([
        { description: '', quantity: 1, unitPrice: 0 }
    ]);

    if (!isOpen || !type) return null;

    const handleAddItem = () => {
        setItems([...items, { description: '', quantity: 1, unitPrice: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: string, value: string | number) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.customerName) {
            toast.error('Customer name is required');
            return;
        }

        if (items.some(i => !i.description || i.quantity <= 0)) {
            toast.error('All items must have valid description and quantity');
            return;
        }

        setLoading(true);

        try {
            const invoiceData = {
                branch_id: activeBranchId,
                type: type.toUpperCase(), // CONFERENCE, GUEST
                customer_name: formData.customerName,
                customer_email: formData.customerEmail,
                invoice_date: formData.date || new Date().toISOString().split('T')[0],
                due_date: formData.dueDate || formData.date || new Date().toISOString().split('T')[0],
                reference_number: formData.reference,
                notes: formData.notes,
                items: items,
                subtotal: calculateTotal(),
                tax_amount: 0,
                total_amount: calculateTotal(),
                status: 'DRAFT' // Start as draft, Auditor confirms
            };

            const response = await accountingAPI.createInvoice(invoiceData);

            if (response.success) {
                toast.success(`${type} Invoice created successfully`);
                onSuccess();
                onClose();
            } else {
                toast.error(response.message || 'Failed to create invoice');
            }
        } catch (error: any) {
            console.error('Invoice creation error:', error);
            toast.error(error.message || 'Failed to create invoice');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <IOSCard className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-0 animate-in fade-in zoom-in duration-200">
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-100 bg-white/80 backdrop-blur-md">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 capitalize">New {type} Invoice</h2>
                        <p className="text-sm text-gray-500">Create a new invoice record</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Customer Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Customer / Org Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.customerName}
                                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder={type === 'conference' ? 'Company Name' : 'Guest Name'}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Email (Optional)</label>
                            <input
                                type="email"
                                value={formData.customerEmail}
                                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="email@example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Invoice Date</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">External Reference</label>
                            <input
                                type="text"
                                value={formData.reference}
                                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="PO Number / External Ref"
                            />
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">Line Items</h3>
                            <button type="button" onClick={handleAddItem} className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1">
                                <Plus className="h-4 w-4" /> Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                                <div className="col-span-6">Description</div>
                                <div className="col-span-2 text-center">Qty</div>
                                <div className="col-span-3 text-right">Price</div>
                                <div className="col-span-1"></div>
                            </div>

                            {items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-start animate-in slide-in-from-left-2 duration-200">
                                    <div className="col-span-6">
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                            placeholder="Item description"
                                            className="w-full p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                            className="w-full p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-center"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.unitPrice}
                                            onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                            className="w-full p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-right"
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center pt-2">
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <div className="bg-gray-50 px-4 py-2 rounded-lg text-right">
                                <p className="text-xs text-gray-500 uppercase font-bold">Total Amount</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(calculateTotal())}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Internal Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[80px]"
                            placeholder="Add any internal notes for the auditor..."
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <IOSButton type="button" variant="secondary" onClick={onClose} className="flex-1">
                            Cancel
                        </IOSButton>
                        <IOSButton type="submit" disabled={loading} className="flex-1">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Create Invoice
                        </IOSButton>
                    </div>
                </form>
            </IOSCard>
        </div>
    );
}
