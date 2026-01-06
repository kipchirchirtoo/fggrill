'use client';

import { useState } from 'react';
import { User, Package, Calculator, CheckCircle2, ChevronRight, ChevronLeft, Plus, Trash2, Printer, Send } from 'lucide-react';
import { toast } from 'sonner';

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
}

export default function InvoiceWizard() {
    const [step, setStep] = useState(1);
    const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
    const [items, setItems] = useState<LineItem[]>([
        { id: '1', description: '', quantity: 1, unitPrice: 0, taxRate: 16 }
    ]);
    const [invoiceDetails, setInvoiceDetails] = useState({
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: ''
    });

    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const taxTotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice * item.taxRate / 100), 0);
    const grandTotal = subtotal + taxTotal;

    const addLineItem = () => {
        setItems([...items, { id: Math.random().toString(), description: '', quantity: 1, unitPrice: 0, taxRate: 16 }]);
    };

    const removeLineItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id: string, field: keyof LineItem, value: any) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const nextStep = () => setStep(step + 1);
    const prevStep = () => setStep(step - 1);

    const handleCreate = async () => {
        toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
            loading: 'Creating invoice...',
            success: 'Invoice created and sent to customer',
            error: 'Failed to create invoice'
        });
        // Redirect or reset would happen here
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Stepper */}
            <div className="flex items-center justify-between mb-8 px-4">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-bold ${step >= s ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400'
                            }`}>
                            {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
                        </div>
                        <span className={`text-[12px] font-bold uppercase tracking-wider ${step >= s ? 'text-stone-900' : 'text-stone-400'
                            }`}>
                            {s === 1 ? 'Customer' : s === 2 ? 'Line Items' : 'Preview'}
                        </span>
                        {s < 3 && <div className="w-12 h-px bg-stone-200 mx-2" />}
                    </div>
                ))}
            </div>

            <div className="card-elevated p-8 min-h-[500px] flex flex-col justify-between">
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="section-header">
                            <h2 className="section-title">Select Customer</h2>
                            <p className="text-[12px] text-stone-500">Choose an existing guest or corporation for this invoice</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => setCustomer({ id: 'G1', name: 'John Doe Ltd' })}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${customer?.id === 'G1' ? 'border-stone-900 bg-stone-50' : 'border-stone-100 hover:border-stone-200'
                                    }`}
                            >
                                <User className="h-5 w-5 text-stone-400 mb-2" />
                                <p className="text-[14px] font-bold">John Doe Ltd</p>
                                <p className="text-[11px] text-stone-500">Corp ID: 100293 • Nairobi</p>
                            </button>
                            <button className="p-4 rounded-xl border-2 border-dashed border-stone-200 hover:border-stone-400 flex flex-col items-center justify-center text-stone-400 gap-2 transition-all">
                                <Plus className="h-5 w-5" />
                                <span className="text-[12px] font-bold">Add New Customer</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-6 mt-6 border-t border-stone-100">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-stone-500 uppercase">Invoice Date</label>
                                <input
                                    type="date"
                                    value={invoiceDetails.date}
                                    onChange={e => setInvoiceDetails({ ...invoiceDetails, date: e.target.value })}
                                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-[13px] outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-stone-500 uppercase">Due Date</label>
                                <input
                                    type="date"
                                    value={invoiceDetails.dueDate}
                                    onChange={e => setInvoiceDetails({ ...invoiceDetails, dueDate: e.target.value })}
                                    className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-[13px] outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <div className="section-header">
                            <h2 className="section-title">Invoice Items</h2>
                            <p className="text-[12px] text-stone-500">Add services or products to this invoice</p>
                        </div>

                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-stone-100">
                                    <th className="pb-3 text-[11px] font-bold text-stone-500 uppercase">Description</th>
                                    <th className="pb-3 text-[11px] font-bold text-stone-500 uppercase text-center w-24">Qty</th>
                                    <th className="pb-3 text-[11px] font-bold text-stone-500 uppercase text-right w-32">Unit Price</th>
                                    <th className="pb-3 text-[11px] font-bold text-stone-500 uppercase text-right w-32">Total</th>
                                    <th className="pb-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-50">
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td className="py-4">
                                            <input
                                                type="text"
                                                placeholder="Service/Item name..."
                                                value={item.description}
                                                onChange={e => updateItem(item.id, 'description', e.target.value)}
                                                className="w-full bg-transparent text-[13px] outline-none focus:text-stone-900"
                                            />
                                        </td>
                                        <td className="py-4 text-center">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value))}
                                                className="w-16 text-center bg-stone-50 py-1 rounded-md text-[13px] font-bold"
                                            />
                                        </td>
                                        <td className="py-4 text-right">
                                            <input
                                                type="number"
                                                value={item.unitPrice}
                                                onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value))}
                                                className="w-24 text-right bg-stone-50 py-1 px-2 rounded-md text-[13px] font-bold"
                                            />
                                        </td>
                                        <td className="py-4 text-right text-[13px] font-bold text-stone-900">
                                            {(item.quantity * item.unitPrice).toLocaleString()}
                                        </td>
                                        <td className="py-4 text-right">
                                            <button onClick={() => removeLineItem(item.id)} className="text-stone-300 hover:text-rose-500 transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <button
                            onClick={addLineItem}
                            className="flex items-center gap-2 text-[12px] font-bold text-stone-500 hover:text-stone-900 transition-colors py-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add Line Item
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6">
                        <div className="p-8 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col items-center text-center">
                            <Calculator className="h-10 w-10 text-stone-300 mb-4" />
                            <h3 className="text-[24px] font-bold text-stone-900">KES {grandTotal.toLocaleString()}</h3>
                            <p className="text-[12px] text-stone-500">Total Invoice Amount (Incl. VAT)</p>

                            <div className="grid grid-cols-2 gap-8 w-full max-w-sm mt-8 pt-8 border-t border-stone-200">
                                <div className="text-left">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase">Subtotal</p>
                                    <p className="font-bold text-stone-700">KES {subtotal.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase">VAT (16%)</p>
                                    <p className="font-bold text-stone-700">KES {taxTotal.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-stone-500 uppercase">Notes / Terms</label>
                            <textarea
                                rows={3}
                                placeholder="Payment terms, bank details, etc..."
                                value={invoiceDetails.notes}
                                onChange={e => setInvoiceDetails({ ...invoiceDetails, notes: e.target.value })}
                                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-stone-200"
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between pt-8 mt-8 border-t border-stone-100">
                    <button
                        onClick={prevStep}
                        disabled={step === 1}
                        className="flex items-center gap-2 text-[13px] font-bold text-stone-400 hover:text-stone-900 disabled:opacity-0 transition-opacity"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </button>

                    <div className="flex gap-3">
                        {step === 3 ? (
                            <>
                                <button className="btn-secondary py-2.5">
                                    <Printer className="h-4 w-4" />
                                    Print PDF
                                </button>
                                <button
                                    onClick={handleCreate}
                                    className="btn-primary bg-stone-900 text-white py-2.5 px-8 flex items-center gap-2 group"
                                >
                                    <Send className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    Create & Send
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={nextStep}
                                disabled={step === 1 && !customer}
                                className="btn-primary bg-stone-900 text-white py-2.5 px-10 disabled:opacity-50"
                            >
                                Continue
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
