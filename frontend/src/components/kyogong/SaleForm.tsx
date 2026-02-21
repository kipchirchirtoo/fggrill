'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, X as XIcon, ShoppingCart, CheckCircle, Printer } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';

interface DynamicService {
    id: number;
    service_type: string;
    name: string;
    pricing_model: string;
    base_price: number;
    price_per_hour: number;
    is_active: boolean;
}

interface CartItem {
    item_id: number;
    item_name: string;
    item_type: string;
    quantity: number;
    unit_price: number;
}

interface SaleFormProps {
    shift: any;
    serviceType?: string; // filter services by type
    onTransactionCreated: (tx: any) => void;
}

export function SaleForm({ shift, serviceType, onTransactionCreated }: SaleFormProps) {
    const [services, setServices] = useState<DynamicService[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MPESA' | 'CARD' | 'BILL'>('BILL');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [lastTransaction, setLastTransaction] = useState<any>(null);
    const { user } = useAuth();
    const { activeBranch } = useBranch();

    const subtotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            const token = localStorage.getItem('token');
            const query = serviceType ? `?service_type=${serviceType}&is_active=true` : '?is_active=true';
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyogong/dynamic-services${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setServices(data.data);
        } catch { /* silently fail */ }
    };

    const addToCart = (service: DynamicService) => {
        const existing = cart.find(i => i.item_id === service.id);
        if (existing) {
            setCart(cart.map(i => i.item_id === service.id
                ? { ...i, quantity: i.quantity + 1 }
                : i));
        } else {
            setCart([...cart, {
                item_id: service.id,
                item_name: service.name,
                item_type: service.service_type,
                quantity: 1,
                unit_price: service.base_price
            }]);
        }
    };

    const removeFromCart = (itemId: number) => {
        setCart(cart.filter(i => i.item_id !== itemId));
    };

    const updateQty = (itemId: number, delta: number) => {
        setCart(cart.map(i => i.item_id === itemId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i).filter(i => i.quantity > 0));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0) { toast.error('Add at least one service'); return; }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/kyogong/shifts/${shift.id}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    service_category: serviceType || 'general',
                    items: cart.map(i => ({
                        item_type: i.item_type,
                        item_id: i.item_id.toString(),
                        item_name: i.item_name,
                        quantity: i.quantity,
                        unit_price: i.unit_price,
                    })),
                    customer_name: customerName || undefined,
                    customer_phone: customerPhone || undefined,
                    payment_method: 'BILL',
                    cash_amount: 0,
                    mpesa_amount: 0,
                    card_amount: 0
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Bill generated successfully!');
                setSubmitted(true);
                onTransactionCreated(data.data);
                setCart([]);
                setCustomerName('');
                setCustomerPhone('');
                setLastTransaction(data.data);

                // Auto-print bill
                setTimeout(() => {
                    handlePrintReceipt(data.data);
                }, 100);

                setTimeout(() => setSubmitted(false), 8000); // Extended timeout to 8s
            } else {
                toast.error(data.error || 'Failed to record sale');
            }
        } catch {
            toast.error('Failed to record sale');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrintReceipt = async (transactionData: any) => {
        if (typeof window === 'undefined') return;

        // Desktop App Native Printing Intercept
        if ((window as any).electronAPI) {
            try {
                const res = await (window as any).electronAPI.invoke('pos:printReceipt', {
                    ...transactionData,
                    branch: activeBranch,
                    user: {
                        firstName: user?.firstName || '',
                        lastName: user?.lastName || ''
                    }
                });
                if (res.success) {
                    toast.success('Sent to printer');
                    return;
                }
            } catch (e) {
                console.warn('Native printing failed, falling back to window.print', e);
            }
        }

        const receiptNumber = transactionData.transaction_number || transactionData.transaction_ref || transactionData.id?.toString().substring(0, 8);
        const dateStr = new Date(transactionData.created_at || new Date()).toLocaleString();
        const cashAmt = transactionData.cash_amount || 0;
        const mpesaAmt = transactionData.mpesa_amount || 0;
        const cardAmt = transactionData.card_amount || 0;
        const tendered = transactionData.amount_tendered || cashAmt;
        const change = Math.max(0, tendered - transactionData.total_amount);

        const items = (transactionData.items || transactionData.details || []).map((item: any) => ({
            name: item.item_name || item.name,
            quantity: item.quantity,
            unit_price: item.unit_price || item.price,
            total: (item.unit_price || item.price) * item.quantity
        }));

        const totalAmount = transactionData.total_amount;
        const b = activeBranch || { name: 'Famous Gates Hotels', location: 'Bomet, Kenya', settings: { phone: '0706782828', pin: '', email: 'famousgatesbmt@gmail.com' } };
        const companyName = b.name.toUpperCase();
        const companyAddress = b.location;
        const companyPhone = b.settings?.phone || '0706782828';
        const companyEmail = b.settings?.email || 'famousgatesbmt@gmail.com';

        const receiptHtml = `
            <html>
                <head>
                    <title>Receipt #${receiptNumber}</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        body { 
                            width: 72mm; 
                            font-family: 'Helvetica', 'Arial', sans-serif; 
                            font-size: 11px; 
                            line-height: 1.2; 
                            color: #000;
                            margin: 0 auto;
                            padding: 4mm 2mm;
                        }
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .header-title { font-size: 15px; margin-bottom: 2px; }
                        .receipt-type { font-size: 12px; margin-top: 5px; }
                        .dashed-line { 
                            border-top: 1px dashed #000; 
                            margin: 6px 0;
                            width: 100%;
                        }
                        .flex { display: flex; justify-content: space-between; }
                        .items-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
                        .items-table th { text-align: left; border-bottom: none; font-size: 10px; font-weight: bold; }
                        .items-table td { padding: 3px 0; vertical-align: top; font-size: 10px; }
                        .total-section { font-size: 11px; }
                        .final-total { font-size: 13px; margin-top: 5px; }
                        .footer-thanks { font-size: 11px; margin-top: 10px; }
                        .footer-small { font-size: 9px; margin-top: 2px; }
                        .hirall-branding { font-size: 8px; font-weight: bold; margin-top: 15px; border-top: 1px dashed #000; padding-top: 8px; }
                        .hirall-contact { font-size: 7px; font-weight: normal; }
                        #barcode { margin-bottom: 5px; max-width: 100%; }
                    </style>
                    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                </head>
                <body>
                    <div class="center">
                        <div style="margin-bottom: 5px;">
                            <img src="/fglogo.png" style="width: 20mm; height: 20mm; object-fit: contain;" onerror="this.style.display='none'">
                        </div>
                        <div class="bold header-title">${companyName}</div>
                        <div>${companyAddress}</div>
                        <div>Tel: ${companyPhone}</div>
                        <div class="bold receipt-type">${transactionData.payment_method === 'BILL' ? 'BILL (UNPAID)' : 'CASH RECEIPT'}</div>
                    </div>

                    <div class="dashed-line"></div>

                    <div style="font-size: 8px;">
                        <div class="flex"><span>Receipt #: ${receiptNumber}</span></div>
                        <div class="flex"><span>Date: ${dateStr}</span></div>
                        ${transactionData.customer_name ? `<div class="flex"><span>Customer: ${transactionData.customer_name}</span></div>` : ''}
                        <div class="flex"><span>Served by: ${user?.firstName || ''} ${user?.lastName || ''}</span></div>
                    </div>

                    <div class="dashed-line"></div>

                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 70%;">Description</th>
                                <th style="width: 30%; text-align: right;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((item: any) => `
                                <tr>
                                    <td>${item.quantity}x ${item.name}</td>
                                    <td style="text-align: right;">${item.total.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="dashed-line"></div>

                    <div class="total-section">
                        <div class="flex">
                            <span>SUBTOTAL</span>
                            <span>KES ${(totalAmount / 1.16).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div class="flex">
                            <span>TAX (16% incl.)</span>
                            <span>KES ${(totalAmount - (totalAmount / 1.16)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div class="flex bold final-total">
                            <span>TOTAL:</span>
                            <span>KES ${totalAmount.toLocaleString()}</span>
                        </div>
                        
                        ${transactionData.payment_method === 'CASH' ? `
                            <div class="flex" style="margin-top: 5px; border-top: 1px dashed #eee; padding-top: 2px;">
                                <span>Amount Paid</span>
                                <span>KES ${tendered.toLocaleString()}</span>
                            </div>
                            <div class="flex bold">
                                <span>Change Due</span>
                                <span>KES ${change.toLocaleString()}</span>
                            </div>
                        ` : ''}

                        ${transactionData.payment_method === 'BILL' ? `
                            <div class="center" style="border: 1px solid #000; padding: 5px; margin-top: 8px; font-weight: bold;">
                                PLEASE PAY AT MAIN CASHIER
                            </div>
                        ` : ''}
                    </div>

                    <div style="margin-top: 10px; font-size: 8px;">
                        <div class="flex"><span>Payment Mode: ${transactionData.payment_method}</span></div>
                    </div>

                    <div class="dashed-line"></div>

                    <div class="center footer-thanks">
                        <div class="bold">THANK YOU!</div>
                        <div class="footer-small">Please come again</div>
                        <div class="footer-small">${companyEmail}</div>
                    </div>

                    <div class="center" style="margin: 10px 0;">
                        <svg id="barcode"></svg>
                    </div>

                    <div class="center hirall-branding">
                        <div>System managed and made by Hirall</div>
                        <div class="hirall-contact">+254 710 944 249 | admin@hirall.com</div>
                    </div>

                    <script>
                        window.onload = function() {
                            try {
                                if (window.JsBarcode) {
                                    const barcodeValue = "${transactionData.transaction_number || receiptNumber}";
                                    JsBarcode("#barcode", barcodeValue, {
                                        format: "CODE128",
                                        width: 2,
                                        height: 50,
                                        displayValue: true,
                                        fontSize: 12,
                                        margin: 10
                                    });
                                } else {
                                    document.getElementById('barcode').style.display = 'none';
                                }
                            } catch(e) {
                                document.getElementById('barcode').style.display = 'none';
                            }
                            window.focus();
                            setTimeout(() => { 
                                window.print();
                                setTimeout(() => { window.close(); }, 500);
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', 'width=450,height=600');
        if (printWindow) {
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
        } else {
            toast.error('Pop-up blocked! Allow pop-ups to print receipts.');
        }
    };

    if (submitted) return (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h3 className="text-3xl font-black text-stone-900 mb-2">BILL GENERATED!</h3>
            <p className="text-stone-400 font-bold uppercase tracking-[0.2em] text-xs mb-8">Ref: {lastTransaction?.transaction_number}</p>

            <div className="flex flex-col gap-4 w-full max-w-sm">
                <button
                    onClick={() => handlePrintReceipt(lastTransaction)}
                    className="flex items-center justify-center gap-3 bg-blue-600 text-white px-8 py-5 rounded-3xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition-all duration-300 shadow-xl shadow-blue-200 active:scale-[0.98]"
                >
                    <Printer className="w-6 h-6" /> Print Receipt
                </button>
                <button
                    onClick={() => {
                        setSubmitted(false);
                        setLastTransaction(null);
                    }}
                    className="text-stone-400 hover:text-stone-900 font-black uppercase tracking-[0.2em] text-[10px] py-4 transition-colors"
                >
                    Create New Sale
                </button>
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Services Grid */}
            <div>
                <h3 className="font-semibold text-gray-900 mb-3">Services</h3>
                <div className="grid grid-cols-2 gap-3">
                    {services.map(service => (
                        <button key={service.id} onClick={() => addToCart(service)}
                            className="bg-white border-2 border-stone-100 rounded-2xl p-4 text-left hover:border-blue-500 hover:bg-blue-50/30 transition-all duration-300 group shadow-sm hover:shadow-md active:scale-[0.98]">
                            <p className="font-bold text-stone-900 group-hover:text-blue-700 line-clamp-2 leading-tight mb-1">{service.name}</p>
                            <p className="text-blue-600 font-black text-sm">KES {service.base_price.toLocaleString()}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Order Panel */}
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" /> Order ({cart.length} items)
                    </h3>
                    {cart.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg text-sm">Select services above</div>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {cart.map(item => (
                                <div key={item.item_id} className="flex items-center gap-4 bg-stone-50/50 border border-stone-100 rounded-2xl p-4 transition-all hover:bg-white hover:shadow-sm">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-stone-900 truncate">{item.item_name}</p>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">KES {item.unit_price.toLocaleString()} each</p>
                                    </div>
                                    <div className="flex items-center bg-white rounded-xl border border-stone-100 p-1 shadow-sm">
                                        <button onClick={() => updateQty(item.item_id, -1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-50 hover:text-stone-900 transition-colors">-</button>
                                        <span className="w-8 text-center text-sm font-black text-stone-900">{item.quantity}</span>
                                        <button onClick={() => updateQty(item.item_id, 1)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">+</button>
                                    </div>
                                    <div className="w-24 text-right">
                                        <p className="text-sm font-black text-stone-900">
                                            KES {(item.quantity * item.unit_price).toLocaleString()}
                                        </p>
                                    </div>
                                    <button onClick={() => removeFromCart(item.item_id)} className="text-stone-300 hover:text-red-500 transition-colors p-1">
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {cart.length > 0 && (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {/* Totals */}
                        <div className="bg-stone-50/80 backdrop-blur-sm rounded-2xl p-5 border border-stone-100 space-y-2 mb-4">
                            <div className="flex justify-between text-stone-500 text-xs font-bold uppercase tracking-widest">
                                <span>Subtotal</span>
                                <span>KES {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-stone-500 text-xs font-bold uppercase tracking-widest">
                                <span>VAT (16%)</span>
                                <span>KES {tax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-stone-200 mt-2">
                                <span className="text-stone-900 font-black uppercase tracking-widest text-sm">Total</span>
                                <span className="text-blue-600 font-black text-2xl">KES {total.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Customer Information */}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Customer Name</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="Enter customer name..."
                                    className="w-full rounded-2xl border-stone-200 bg-stone-50/50 py-4 px-5 text-base font-medium placeholder:text-stone-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5 ml-1">Phone Number (Optional)</label>
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={e => setCustomerPhone(e.target.value)}
                                    placeholder="Enter phone number..."
                                    className="w-full rounded-2xl border-stone-200 bg-stone-50/50 py-4 px-5 text-base font-medium placeholder:text-stone-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-black disabled:opacity-50 flex items-center justify-center gap-3 transition-all duration-300 shadow-xl shadow-stone-200 active:scale-[0.98]"
                            >
                                {isSubmitting ? <><Loader2 className="w-6 h-6 animate-spin" />Processing...</> : <><Plus className="w-5 h-5" /> Generate Bill</>}
                            </button>
                            <p className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-4">
                                Payments are processed at the Main Cashier Station
                            </p>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
