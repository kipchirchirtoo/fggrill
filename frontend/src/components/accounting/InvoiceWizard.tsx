'use client';

import { useState } from 'react';
import { User, Package, Calculator, CheckCircle2, ChevronRight, ChevronLeft, Plus, Trash2, Printer, Send, Bed, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number; // VAT (usually 16%)
    isAccommodation: boolean; // Triggers Levy (2%)
    hasServiceCharge: boolean; // Triggers Service Charge (e.g., 10%)
}

export default function InvoiceWizard() {
    const [step, setStep] = useState(1);
    const [customer, setCustomer] = useState<{ id: string; name: string; type: 'guest' | 'corp'; room?: string } | null>(null);
    const [items, setItems] = useState<LineItem[]>([
        { id: '1', description: 'Accommodation - Deluxe Room', quantity: 1, unitPrice: 15000, taxRate: 16, isAccommodation: true, hasServiceCharge: true }
    ]);
    const [invoiceDetails, setInvoiceDetails] = useState({
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: ''
    });

    // Calculations
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);

    // Tourism Levy (2% on Accommodation)
    const levyTotal = items.reduce((acc, item) => {
        return item.isAccommodation ? acc + (item.quantity * item.unitPrice * 0.02) : acc;
    }, 0);

    // Service Charge (10% on applicable items)
    const serviceChargeTotal = items.reduce((acc, item) => {
        return item.hasServiceCharge ? acc + (item.quantity * item.unitPrice * 0.10) : acc;
    }, 0);

    // VAT (16% on Vatable amount)
    // Note: VAT calculation base depends on local laws. Usually on (Base + Service Charge). Levy is often exempt or inclusive.
    // Adjusted for simple hotel tax logic: VAT on (Base + Service Charge)
    const vatTotal = items.reduce((acc, item) => {
        const base = item.quantity * item.unitPrice;
        const sc = item.hasServiceCharge ? base * 0.10 : 0;
        return acc + ((base + sc) * (item.taxRate / 100));
    }, 0);

    const grandTotal = subtotal + levyTotal + serviceChargeTotal + vatTotal;

    const addLineItem = () => {
        setItems([...items, {
            id: Math.random().toString(),
            description: '',
            quantity: 1,
            unitPrice: 0,
            taxRate: 16,
            isAccommodation: false,
            hasServiceCharge: false
        }]);
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
                            {s === 1 ? 'Customer' : s === 2 ? 'Details' : 'Review'}
                        </span>
                        {s < 3 && <div className="w-12 h-px bg-stone-200 mx-2" />}
                    </div>
                ))}
            </div>

            <div className="card-elevated p-8 min-h-[500px] flex flex-col justify-between">
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="section-header">
                            <h2 className="section-title">Bill To</h2>
                            <p className="text-[12px] text-stone-500">Select guest, company, or room for billing</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Option 1: Corporate/Company */}
                            <button
                                onClick={() => setCustomer({ id: 'c1', name: 'John Doe Ltd', type: 'corp' })}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${customer?.id === 'c1' ? 'border-stone-900 bg-stone-50' : 'border-stone-100 hover:border-stone-200'
                                    }`}
                            >
                                <Building2 className="h-5 w-5 text-stone-400 mb-2" />
                                <p className="text-[14px] font-bold">John Doe Ltd</p>
                                <p className="text-[11px] text-stone-500">Corporate Account • ID: 100293</p>
                            </button>

                            {/* Option 2: In-House Guest */}
                            <button
                                onClick={() => setCustomer({ id: 'g1', name: 'Sarah Connor', type: 'guest', room: '304' })}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${customer?.id === 'g1' ? 'border-stone-900 bg-stone-50' : 'border-stone-100 hover:border-stone-200'
                                    }`}
                            >
                                <Bed className="h-5 w-5 text-stone-400 mb-2" />
                                <div className="flex justify-between items-center">
                                    <p className="text-[14px] font-bold">Sarah Connor</p>
                                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">In-House</span>
                                </div>
                                <p className="text-[11px] text-stone-500">Room 304 • Checked in: Yesterday</p>
                            </button>

                            <button className="p-4 rounded-xl border-2 border-dashed border-stone-200 hover:border-stone-400 flex flex-col items-center justify-center text-stone-400 gap-2 transition-all">
                                <Plus className="h-5 w-5" />
                                <span className="text-[12px] font-bold">Add New Guest/Client</span>
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
                            <h2 className="section-title">Services & Charges</h2>
                            <p className="text-[12px] text-stone-500">Add detailed line items with tax configuration</p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-stone-100">
                                        <th className="pb-3 text-[11px] font-bold text-stone-500 uppercase w-5/12">Description</th>
                                        <th className="pb-3 text-[11px] font-bold text-stone-500 uppercase text-center w-1/12">Qty</th>
                                        <th className="pb-3 text-[11px] font-bold text-stone-500 uppercase text-right w-2/12">Price</th>
                                        <th className="pb-3 text-[11px] font-bold text-stone-500 uppercase text-center w-2/12">Tax Config</th>
                                        <th className="pb-3 text-[11px] font-bold text-stone-500 uppercase text-right w-2/12">Total</th>
                                        <th className="pb-3 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {items.map((item) => (
                                        <tr key={item.id} className="group">
                                            <td className="py-4 align-top">
                                                <div className="space-y-1">
                                                    <input
                                                        type="text"
                                                        placeholder="Item description..."
                                                        value={item.description}
                                                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                                                        className="w-full bg-transparent text-[13px] font-medium outline-none placeholder:text-stone-300"
                                                    />
                                                    <div className="flex gap-2">
                                                        <label className="flex items-center gap-1.5 cursor-pointer hover:bg-stone-50 px-2 py-1 rounded transition-colors border border-transparent hover:border-stone-100">
                                                            <input
                                                                type="checkbox"
                                                                checked={item.isAccommodation}
                                                                onChange={e => updateItem(item.id, 'isAccommodation', e.target.checked)}
                                                                className="rounded border-stone-300 text-stone-900 focus:ring-stone-900 h-3 w-3"
                                                            />
                                                            <span className="text-[11px] text-stone-500">Accommodation (Levy)</span>
                                                        </label>
                                                        <label className="flex items-center gap-1.5 cursor-pointer hover:bg-stone-50 px-2 py-1 rounded transition-colors border border-transparent hover:border-stone-100">
                                                            <input
                                                                type="checkbox"
                                                                checked={item.hasServiceCharge}
                                                                onChange={e => updateItem(item.id, 'hasServiceCharge', e.target.checked)}
                                                                className="rounded border-stone-300 text-stone-900 focus:ring-stone-900 h-3 w-3"
                                                            />
                                                            <span className="text-[11px] text-stone-500">Service Chg</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 text-center align-top">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-12 text-center bg-stone-50 py-1.5 rounded-md text-[13px] font-bold"
                                                />
                                            </td>
                                            <td className="py-4 text-right align-top">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.unitPrice}
                                                    onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                    className="w-20 text-right bg-stone-50 py-1.5 px-2 rounded-md text-[13px] font-bold"
                                                />
                                            </td>
                                            <td className="py-4 text-center align-top">
                                                <select
                                                    value={item.taxRate}
                                                    onChange={e => updateItem(item.id, 'taxRate', parseFloat(e.target.value))}
                                                    className="bg-stone-50 text-[11px] py-1.5 px-1 rounded-md border-none outline-none font-medium"
                                                >
                                                    <option value={16}>VAT 16%</option>
                                                    <option value={0}>Exempt 0%</option>
                                                    <option value={8}>Reduced 8%</option>
                                                </select>
                                            </td>
                                            <td className="py-4 text-right text-[13px] font-bold text-stone-900 align-top pt-3">
                                                {(item.quantity * item.unitPrice).toLocaleString()}
                                            </td>
                                            <td className="py-4 text-right align-top pt-2">
                                                <button onClick={() => removeLineItem(item.id)} className="text-stone-300 hover:text-rose-500 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            onClick={addLineItem}
                            className="flex items-center gap-2 text-[12px] font-bold text-stone-500 hover:text-stone-900 transition-colors py-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add Service / Item
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6">
                        <div className="p-8 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col items-center text-center">
                            <Calculator className="h-10 w-10 text-stone-300 mb-4" />
                            <h3 className="text-[32px] font-bold text-stone-900 tracking-tight">KES {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            <p className="text-[12px] text-stone-500 font-medium">Total Amount Payable</p>

                            <div className="w-full max-w-sm mt-8 pt-8 border-t border-stone-200 space-y-3">
                                <div className="flex justify-between text-[13px]">
                                    <span className="text-stone-500">Subtotal</span>
                                    <span className="font-semibold text-stone-700">{subtotal.toLocaleString()}</span>
                                </div>
                                {serviceChargeTotal > 0 && (
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-stone-500">Service Charge (10%)</span>
                                        <span className="font-semibold text-stone-700">{serviceChargeTotal.toLocaleString()}</span>
                                    </div>
                                )}
                                {levyTotal > 0 && (
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-stone-500">Tourism Levy (2%)</span>
                                        <span className="font-semibold text-stone-700">{levyTotal.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-[13px]">
                                    <span className="text-stone-500">VAT (16%)</span>
                                    <span className="font-semibold text-stone-700">{vatTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-stone-500 uppercase">Internal Notes / Payment Terms</label>
                            <textarea
                                rows={3}
                                placeholder="e.g. Payment due within 14 days. Bank details: Equity Bank..."
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
                        Back
                    </button>

                    <div className="flex gap-3">
                        {step === 3 ? (
                            <>
                                <button className="btn-secondary py-2.5">
                                    <Printer className="h-4 w-4" />
                                    Print
                                </button>
                                <button
                                    onClick={handleCreate}
                                    className="btn-primary bg-stone-900 text-white py-2.5 px-8 flex items-center gap-2 group"
                                >
                                    <Send className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                    Generate & Send
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
