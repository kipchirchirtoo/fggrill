'use client';

import { useState } from 'react';
import { FileText, Plus, Trash2, Calendar, FileDown, Send, ArrowRight, User, Hash, Bed } from 'lucide-react';
import { toast } from 'sonner';

interface QuotationItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    isAccommodation: boolean;
    hasServiceCharge: boolean;
}

export default function QuotationForm() {
    const [items, setItems] = useState<QuotationItem[]>([
        { id: '1', description: 'Royal Suite (3 Nights)', quantity: 3, unitPrice: 15000, isAccommodation: true, hasServiceCharge: true },
        { id: '2', description: 'Full Board Catering (5 Adults)', quantity: 5, unitPrice: 3500, isAccommodation: false, hasServiceCharge: true },
    ]);
    const [customer, setCustomer] = useState('Global Tech Solutions');

    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);

    const levyTotal = items.reduce((acc, item) =>
        item.isAccommodation ? acc + (item.quantity * item.unitPrice * 0.02) : acc
        , 0);

    const serviceChargeTotal = items.reduce((acc, item) =>
        item.hasServiceCharge ? acc + (item.quantity * item.unitPrice * 0.10) : acc
        , 0);

    const vatTotal = items.reduce((acc, item) => {
        const base = item.quantity * item.unitPrice;
        const sc = item.hasServiceCharge ? base * 0.10 : 0;
        return acc + ((base + sc) * 0.16);
    }, 0);

    const total = subtotal + levyTotal + serviceChargeTotal + vatTotal;

    const addItem = () => {
        setItems([...items, { id: Math.random().toString(), description: '', quantity: 1, unitPrice: 0, isAccommodation: false, hasServiceCharge: false }]);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id: string, field: keyof QuotationItem, value: any) => {
        setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const handleSend = () => {
        toast.success('Quotation sent to customer via email');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="card-elevated p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-10 border-b border-stone-100">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-stone-900 flex items-center justify-center text-white">
                                <FileText className="h-7 w-7" />
                            </div>
                            <div>
                                <h2 className="text-[20px] font-bold text-stone-900">New Quotation</h2>
                                <p className="text-[12px] text-stone-500 font-medium">Create a formal estimate for services</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Status</p>
                            <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-[11px] font-bold">DRAFT</span>
                        </div>
                    </div>

                    {/* Customer Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                        <div className="space-y-4">
                            <label className="text-[11px] font-bold text-stone-500 uppercase flex items-center gap-2">
                                <User className="h-3.5 w-3.5" /> Customer Details
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={customer}
                                    onChange={(e) => setCustomer(e.target.value)}
                                    placeholder="Search or enter customer name..."
                                    className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl text-[13px] font-bold outline-none focus:border-stone-900 transition-all"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <label className="text-[11px] font-bold text-stone-500 uppercase flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5" /> Date
                                </label>
                                <input type="date" className="w-full p-3.5 bg-stone-50 border border-stone-100 rounded-xl text-[12px] font-medium" />
                            </div>
                            <div className="space-y-4">
                                <label className="text-[11px] font-bold text-stone-500 uppercase flex items-center gap-2">
                                    <Hash className="h-3.5 w-3.5" /> Reference
                                </label>
                                <input type="text" placeholder="PO-9842" className="w-full p-3.5 bg-stone-50 border border-stone-100 rounded-xl text-[12px] font-medium" />
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-4 pb-4 border-b border-stone-100">
                            <div className="col-span-5 text-[11px] font-bold text-stone-400 uppercase">Item Description</div>
                            <div className="col-span-3 text-[11px] font-bold text-stone-400 uppercase text-center">Settings</div>
                            <div className="col-span-1 text-[11px] font-bold text-stone-400 uppercase text-center">Qty</div>
                            <div className="col-span-2 text-[11px] font-bold text-stone-400 uppercase text-right">Price</div>
                            <div className="col-span-1"></div>
                        </div>

                        <div className="space-y-3">
                            {items.map((item) => (
                                <div key={item.id} className="grid grid-cols-12 gap-4 items-start group">
                                    <div className="col-span-5">
                                        <textarea
                                            rows={2}
                                            value={item.description}
                                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                            placeholder="Enter service description..."
                                            className="w-full p-3 bg-transparent border-b border-stone-50 text-[13px] outline-none group-hover:border-stone-200 focus:border-stone-900 resize-none"
                                        />
                                    </div>
                                    <div className="col-span-3 flex flex-col gap-2 pt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={item.isAccommodation}
                                                onChange={(e) => updateItem(item.id, 'isAccommodation', e.target.checked)}
                                                className="rounded border-stone-300 text-stone-900 h-3 w-3"
                                            />
                                            <span className="text-[10px] text-stone-500">Accommodation (Levy)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={item.hasServiceCharge}
                                                onChange={(e) => updateItem(item.id, 'hasServiceCharge', e.target.checked)}
                                                className="rounded border-stone-300 text-stone-900 h-3 w-3"
                                            />
                                            <span className="text-[10px] text-stone-500">Service Charge</span>
                                        </label>
                                    </div>
                                    <div className="col-span-1 pt-2">
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value))}
                                            className="w-full p-1.5 bg-stone-50 border border-transparent rounded-lg text-center text-[13px] font-bold focus:bg-white focus:border-stone-200 transition-all"
                                        />
                                    </div>
                                    <div className="col-span-2 pt-2">
                                        <input
                                            type="number"
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value))}
                                            className="w-full p-1.5 bg-stone-50 border border-transparent rounded-lg text-right text-[13px] font-bold focus:bg-white focus:border-stone-200 transition-all"
                                        />
                                    </div>
                                    <div className="col-span-1 text-right pt-2">
                                        <button onClick={() => removeItem(item.id)} className="p-2 text-stone-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addItem}
                            className="w-full py-4 border-2 border-dashed border-stone-100 rounded-2xl text-[12px] font-bold text-stone-400 hover:text-stone-900 hover:border-stone-300 transition-all mt-4 flex items-center justify-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Add Line Item
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="card-elevated p-8 space-y-8 bg-stone-900 text-white">
                    <h3 className="text-[16px] font-bold">Quotation Summary</h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-[13px] text-stone-400">
                            <span>Subtotal</span>
                            <span className="font-bold text-white">KES {subtotal.toLocaleString()}</span>
                        </div>
                        {levyTotal > 0 && (
                            <div className="flex items-center justify-between text-[13px] text-stone-400">
                                <span>Levy (2%)</span>
                                <span className="font-bold text-white">KES {levyTotal.toLocaleString()}</span>
                            </div>
                        )}
                        {serviceChargeTotal > 0 && (
                            <div className="flex items-center justify-between text-[13px] text-stone-400">
                                <span>Service Charge (10%)</span>
                                <span className="font-bold text-white">KES {serviceChargeTotal.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between text-[13px] text-stone-400">
                            <span>Tax (VAT 16%)</span>
                            <span className="font-bold text-white">KES {vatTotal.toLocaleString()}</span>
                        </div>
                        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                            <span className="text-[14px] font-bold">Grand Total</span>
                            <span className="text-[22px] font-bold">KES {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                    </div>

                    <div className="space-y-3 pt-6">
                        <button
                            onClick={handleSend}
                            className="w-full py-4 bg-white text-stone-900 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-stone-100 transition-all shadow-lg"
                        >
                            <Send className="h-4 w-4" />
                            Send to Customer
                        </button>
                        <button className="w-full py-4 bg-white/10 text-white rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-white/20 transition-all">
                            <FileDown className="h-4 w-4" />
                            Download PDF
                        </button>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
                        <p className="text-[11px] text-stone-400 mb-2 font-medium">Ready for next step?</p>
                        <button className="text-[12px] font-bold text-white flex items-center gap-2 mx-auto hover:gap-3 transition-all">
                            Convert to Invoice <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
