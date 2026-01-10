'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    CheckCircle, XCircle, Search, AlertCircle, Receipt, Clock,
    User, DollarSign, CreditCard, Scan, Printer, Loader2,
    Banknote, AlertTriangle, Layout, Calculator
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { IOSCard } from '@/components/ui/ios-card';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';

export default function CashierPage() {
    const [scanInput, setScanInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [billData, setBillData] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [mpesaCode, setMpesaCode] = useState('');
    const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input on load
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scanInput.trim()) return;

        setIsLoading(true);
        try {
            const bookingId = scanInput.trim();
            const response = await fetchAPI(`/cashier/bill/${bookingId}`) as any;
            if (response.success) {
                setBillData(response.data);
                setPaymentAmount(response.data.financials.balance.toString());
                toast.success('Bill retrieved successfully');
            } else {
                toast.error('Bill not found');
                setBillData(null);
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to fetch bill');
            setBillData(null);
        } finally {
            setIsLoading(false);
            setScanInput('');
        }
    };

    const handlePayment = async () => {
        if (!billData) return;

        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid payment amount');
            return;
        }

        if (amount > billData.financials.balance) {
            toast.error(`Amount exceeds balance! Max: KES ${billData.financials.balance.toLocaleString()}`);
            return;
        }

        if (paymentMethod === 'mpesa' && !mpesaCode) {
            toast.error('M-Pesa confirmation code required');
            return;
        }

        setIsProcessing(true);
        try {
            const identifier = (billData.type === 'restaurant' || billData.type === 'bar') ? billData.order.order_number : billData.booking.id;
            const methodKey = paymentMethod === 'mpesa' ? 'mpesa_manual' : (paymentMethod === 'card' ? 'card_manual' : 'cash');

            const response = await fetchAPI('/cashier/pay', {
                method: 'POST',
                body: JSON.stringify({
                    bookingId: identifier,
                    amount: amount,
                    method: methodKey,
                    reference: paymentMethod === 'mpesa' ? mpesaCode : `${paymentMethod.toUpperCase()}-${Date.now()}`
                })
            }) as any;

            if (response.success) {
                const isPending = response.data.status === 'pending';
                toast.success(isPending ? 'Payment recorded as PENDING' : 'Payment verified successfully');

                // Add to local history
                const newTxn = {
                    id: response.data.id,
                    customerName: (billData.type === 'restaurant' || billData.type === 'bar') ? billData.order.guest_name : billData.booking.guest_name,
                    billNo: identifier,
                    amount: amount,
                    paymentMethod: paymentMethod,
                    status: response.data.status,
                    timestamp: new Date().toLocaleString('en-KE'),
                    mpesaCode: paymentMethod === 'mpesa' ? mpesaCode : null
                };
                setTransactionHistory([newTxn, ...transactionHistory]);

                // Refresh bill data
                const refresh = await fetchAPI(`/cashier/bill/${identifier}`) as any;
                if (refresh.success) {
                    setBillData(refresh.data);
                    setPaymentAmount(refresh.data.financials.balance.toString());
                    setMpesaCode('');
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Payment failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleVerify = async (paymentId: string) => {
        setIsProcessing(true);
        try {
            const response = await fetchAPI('/cashier/verify-payment', {
                method: 'POST',
                body: JSON.stringify({ paymentId })
            }) as any;

            if (response.success) {
                toast.success('Payment verified successfully');

                // Update local history status
                setTransactionHistory(prev => prev.map(txn =>
                    txn.id === paymentId ? { ...txn, status: 'completed' } : txn
                ));

                // Refresh bill data
                const identifier = (billData.type === 'restaurant' || billData.type === 'bar') ? billData.order.order_number : billData.booking.id;
                const refresh = await fetchAPI(`/cashier/bill/${identifier}`) as any;
                if (refresh.success) {
                    setBillData(refresh.data);
                    setPaymentAmount(refresh.data.financials.balance.toString());
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Verification failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.CASHIER, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.RECEPTIONIST]}>
            <DashboardLayout>
                <div className="space-y-6 max-w-[1600px] mx-auto">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900">Cashier Station</h1>
                            <p className="text-stone-500 text-sm">Verify and process payments for hotel and restaurant bills</p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            CASHIER ONLINE
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Content Area */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Search Section */}
                            <IOSCard className="p-6 border-none shadow-sm bg-white">
                                <h2 className="text-lg font-bold mb-4 text-stone-800 flex items-center gap-2">
                                    <Search size={20} className="text-orange-600" />
                                    Search Bill
                                </h2>

                                <form onSubmit={handleScan} className="flex gap-3">
                                    <div className="relative flex-1">
                                        <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                        <Input
                                            ref={inputRef}
                                            type="text"
                                            placeholder="Scan barcode or enter ID (ORD..., BAR... or HTL...)"
                                            value={scanInput}
                                            onChange={(e) => setScanInput(e.target.value)}
                                            className="pl-10 h-11 bg-stone-50 border-stone-200 focus:border-orange-500"
                                        />
                                    </div>
                                    <IOSButton
                                        type="submit"
                                        disabled={isLoading}
                                        className="bg-orange-600 hover:bg-orange-700 text-white h-11 px-8"
                                    >
                                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lookup'}
                                    </IOSButton>
                                </form>
                            </IOSCard>

                            {/* Bill Details */}
                            {billData && (
                                <IOSCard className="p-6 border-none shadow-sm bg-white animate-in fade-in slide-in-from-bottom-4">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                                                <Receipt size={20} className="text-orange-600" />
                                                Bill Details
                                            </h2>
                                            <button
                                                onClick={() => toast.info('Printing receipt...')}
                                                className="flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                <Printer size={14} />
                                                Print
                                            </button>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${billData.financials.balance === 0
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                                            }`}>
                                            {billData.financials.balance === 0 ? 'Fully Paid' : 'Payment Pending'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                                        <div>
                                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">Bill Number</p>
                                            <p className="font-bold text-stone-900">{(billData.type === 'restaurant' || billData.type === 'bar') ? billData.order.order_number : billData.booking.id.slice(0, 8)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">Customer</p>
                                            <p className="font-bold text-stone-900">{(billData.type === 'restaurant' || billData.type === 'bar') ? billData.order.guest_name : billData.booking.guest_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">Module</p>
                                            <p className="font-bold text-stone-900 capitalize">{billData.type}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">{billData.type === 'hotel' ? 'Room' : 'Table'}</p>
                                            <p className="font-bold text-stone-900">
                                                {billData.type === 'hotel' ? billData.booking.room_number : (billData.order.table_number || 'N/A')}
                                            </p>
                                        </div>
                                        {billData.type === 'hotel' && (
                                            <>
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">Check In</p>
                                                    <p className="font-bold text-stone-900">{new Date(billData.booking.check_in).toLocaleDateString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tight">Check Out</p>
                                                    <p className="font-bold text-stone-900">{new Date(billData.booking.check_out).toLocaleDateString()}</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {(billData.type === 'restaurant' || billData.type === 'bar') && billData.order.items && (
                                        <div className="mb-8">
                                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tight mb-3">Order Items</p>
                                            <div className="bg-stone-50 rounded-xl p-4 space-y-2 border border-stone-100">
                                                {billData.order.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between text-sm">
                                                        <span className="text-stone-600">{item.name} <span className="text-stone-400 text-xs">x{item.quantity}</span></span>
                                                        <span className="font-bold text-stone-900">KES {item.total.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-stone-900 rounded-2xl p-6 text-white space-y-3">
                                        <div className="flex justify-between text-stone-400 text-sm">
                                            <span>Total Amount</span>
                                            <span className="font-bold text-white">KES {billData.financials.total_amount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-emerald-400 text-sm">
                                            <span>Amount Paid</span>
                                            <span className="font-bold">- KES {billData.financials.amount_paid.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xl font-black pt-3 border-t border-stone-800">
                                            <span className="text-stone-300">Balance Due</span>
                                            <span className={billData.financials.balance > 0 ? 'text-orange-500' : 'text-emerald-500'}>
                                                KES {billData.financials.balance.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </IOSCard>
                            )}
                        </div>

                        {/* Sidebar: Payment & History */}
                        <div className="space-y-6">
                            {/* Payment Verification */}
                            {billData && billData.financials.balance > 0 && (
                                <IOSCard className="p-6 border-none shadow-sm bg-white">
                                    <h2 className="text-lg font-bold mb-4 text-stone-800 flex items-center gap-2">
                                        <Calculator size={20} className="text-orange-600" />
                                        Process Payment
                                    </h2>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5">Method</label>
                                            <select
                                                value={paymentMethod}
                                                onChange={(e) => setPaymentMethod(e.target.value)}
                                                className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:border-orange-500 focus:outline-none"
                                            >
                                                <option value="cash">Cash Payment</option>
                                                <option value="mpesa">M-Pesa Mobile</option>
                                                <option value="card">Card (POS Terminal)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5">Amount (KES)</label>
                                            <Input
                                                type="number"
                                                value={paymentAmount}
                                                onChange={(e) => setPaymentAmount(e.target.value)}
                                                className="h-11 bg-stone-50 border-stone-200 font-bold text-stone-900"
                                            />
                                        </div>

                                        {paymentMethod === 'mpesa' && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5">M-Pesa Reference</label>
                                                <Input
                                                    type="text"
                                                    placeholder="e.g. QWE123RTY"
                                                    value={mpesaCode}
                                                    onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                                                    className="h-11 bg-stone-50 border-stone-200 font-mono"
                                                />
                                            </div>
                                        )}

                                        <IOSButton
                                            onClick={handlePayment}
                                            disabled={isProcessing}
                                            className="w-full bg-stone-900 hover:bg-black text-white h-12 font-bold rounded-xl mt-2"
                                        >
                                            {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'Verify & Post Payment'}
                                        </IOSButton>

                                        <button
                                            onClick={() => { setBillData(null); setScanInput(''); }}
                                            className="w-full text-stone-400 text-xs font-bold hover:text-stone-600 transition-colors py-2"
                                        >
                                            Cancel & Clear
                                        </button>
                                    </div>
                                </IOSCard>
                            )}

                            {/* Recent Transactions */}
                            <IOSCard className="p-6 border-none shadow-sm bg-white">
                                <h2 className="text-lg font-bold mb-4 text-stone-800 flex items-center gap-2">
                                    <Clock size={20} className="text-orange-600" />
                                    Recent Activity
                                </h2>

                                {transactionHistory.length === 0 ? (
                                    <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                                        <AlertCircle size={32} className="mx-auto mb-2 text-stone-300" />
                                        <p className="text-xs text-stone-400 font-medium">No transactions yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                                        {transactionHistory.map((txn) => (
                                            <div key={txn.id} className="p-3 bg-stone-50 rounded-xl border border-stone-100 relative group">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[9px] font-bold text-stone-400 font-mono">{txn.id.slice(0, 8)}</span>
                                                    <span className="text-[9px] font-bold text-stone-400">{txn.timestamp.split(',')[1]}</span>
                                                </div>
                                                <p className="font-bold text-stone-900 text-xs truncate">{txn.customerName}</p>
                                                <div className="flex justify-between items-center mt-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] bg-white border border-stone-200 text-stone-600 px-2 py-0.5 rounded-full font-bold uppercase">
                                                            {txn.paymentMethod}
                                                        </span>
                                                        {txn.status === 'pending' && (
                                                            <span className="text-[9px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-bold uppercase border border-orange-100">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`font-black text-xs ${txn.status === 'pending' ? 'text-stone-400' : 'text-emerald-600'}`}>
                                                        KES {txn.amount.toLocaleString()}
                                                    </span>
                                                </div>
                                                {txn.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleVerify(txn.id)}
                                                        className="w-full mt-2 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <CheckCircle size={12} />
                                                        Verify Now
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </IOSCard>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
