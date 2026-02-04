'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    User, DollarSign, CreditCard, Scan, Printer, Loader2,
    Banknote, AlertTriangle, Layout, Calculator, BarChart3, TrendingUp, Activity,
    History, Trash2, ShoppingCart, Search, Receipt, Clock, AlertCircle, CheckCircle
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, LineChart, Line, AreaChart, Area
} from 'recharts';
import { toast } from 'sonner';
import { fetchAPI, receiptsAPI, restaurantAPI } from '@/lib/api';
import { PYTHON_API_URL } from '@/lib/config';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { IOSCard } from '@/components/ui/ios-card';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';

import { CashierLogbook } from '@/components/cashier/CashierLogbook';
import {
    saveOfflineTransaction,
    getUnsyncedTransactions,
    markTransactionSynced,
    cacheProducts,
    searchProductsOffline,
    OfflineProduct
} from '@/lib/indexedDB';
import { POSReceipt } from '@/components/cashier/POSReceipt';

function CashierPageContent() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab') as any;
    const [activeTab, setActiveTab] = useState<'station' | 'logbook' | 'insights'>(
        ['station', 'logbook', 'insights'].includes(tabParam) ? tabParam : 'station'
    );

    useEffect(() => {
        if (['station', 'logbook', 'insights'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const [scanInput, setScanInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingBill, setIsGeneratingBill] = useState(false);
    const [billData, setBillData] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [mpesaCode, setMpesaCode] = useState('');
    const [isPollingMpesa, setIsPollingMpesa] = useState(false);
    const [mpesaTransactionDetails, setMpesaTransactionDetails] = useState<any>(null);
    const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
    const [isPOSType, setIsPOSType] = useState(false);
    const [cart, setCart] = useState<any[]>([]);
    const [isOffline, setIsOffline] = useState(false);
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const [insightsData, setInsightsData] = useState<any>(null);
    const [forecastData, setForecastData] = useState<any>(null);
    const [stockAlerts, setStockAlerts] = useState<any>(null);
    const [isInsightLoading, setIsInsightLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();

        // Check online status
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setIsOffline(!navigator.onLine);

        // Sync offline transactions when back online
        if (!isOffline) {
            syncOfflineTransactions();
        }

        if (activeTab === 'insights') {
            fetchInsights();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isOffline]);

    const fetchInsights = async () => {
        setIsInsightLoading(true);
        try {
            const pythonUrl = `${PYTHON_API_URL}/api/analytics`;
            const insightsRes = await fetch(`${pythonUrl}/pos/insights`);
            const forecastRes = await fetch(`${pythonUrl}/pos/forecast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ periods: 7 })
            });
            const alertsRes = await fetch(`${pythonUrl}/pos/stock-alerts`);

            if (insightsRes.ok) {
                const data = await insightsRes.json();
                setInsightsData(data.data);
            }
            if (forecastRes.ok) {
                const data = await forecastRes.json();
                setForecastData(data.data);
            }
            if (alertsRes.ok) {
                const data = await alertsRes.json();
                setStockAlerts(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch insights', error);
        } finally {
            setIsInsightLoading(false);
        }
    };

    const syncOfflineTransactions = async () => {
        const unsynced = await getUnsyncedTransactions();
        if (unsynced.length === 0) return;

        toast.info(`Syncing ${unsynced.length} offline transactions...`);
        for (const tx of unsynced) {
            try {
                const response = await fetchAPI('/cashier/pos/transactions', {
                    method: 'POST',
                    body: JSON.stringify({
                        items: tx.items,
                        customer_name: tx.customer_name,
                        customer_phone: tx.customer_phone,
                        total_amount: tx.total_amount,
                        offline_id: tx.id
                    })
                }) as any;

                if (response.success) {
                    await markTransactionSynced(tx.id);
                }
            } catch (error) {
                console.error('Failed to sync transaction', tx.id, error);
            }
        }
    };

    const syncProducts = async () => {
        try {
            const response = await fetchAPI('/restaurant/menu/items') as any;
            if (response.success && Array.isArray(response.data)) {
                const products: OfflineProduct[] = response.data.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    price: Number(item.price),
                    barcode: item.id, // Fallback if no specific barcode field
                    sku: item.id,
                    category: item.category_id
                }));
                await cacheProducts(products);
                console.log('Products cached for offline mode');
            }
        } catch (error) {
            console.error('Failed to sync products', error);
        }
    };

    // Initial sync
    useEffect(() => {
        if (!isOffline) {
            syncProducts();
        }
    }, [isOffline]);

    const handlePOSSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const query = scanInput.trim();
        if (!query) return;

        // Search local cache (works offline and online for speed)
        const results = await searchProductsOffline(query);

        if (results.length > 0) {
            // Pick exact match or first result
            const product = results[0];
            const existing = cart.find(i => i.product_id === product.id);

            if (existing) {
                setCart(cart.map(i => i.product_id === product.id ? { ...i, qty: i.qty + 1, line_total: (i.qty + 1) * i.unit_price } : i));
                toast.success(`Added another ${product.name}`);
            } else {
                setCart([...cart, {
                    product_id: product.id,
                    name: product.name,
                    qty: 1,
                    unit_price: product.price,
                    line_total: product.price
                }]);
                toast.success(`Added ${product.name}`);
            }
            setScanInput('');
        } else {
            toast.error('Product not found in local catalog');
            if (isOffline) {
                toast.info('You are offline. Only cached items are available.');
            }
        }
    };

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

                if (!isPending) {
                    setSelectedTransaction({
                        ...response.data,
                        transaction_ref: response.data.reference,
                        created_at: new Date().toISOString(),
                        cashier_name: 'Current Cashier',
                        total_amount: amount,
                        payment_method: paymentMethod,
                        items: billData.order?.items || []
                    });
                    setShowReceipt(true);
                }

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

    const pollMpesaStatus = async (checkoutRequestId: string) => {
        setIsPollingMpesa(true);
        let attempts = 0;
        const maxAttempts = 20; // 1 minute roughly (3s interval)

        const poll = async () => {
            if (attempts >= maxAttempts) {
                setIsPollingMpesa(false);
                toast.error('M-Pesa polling timed out. Please enter code manually.');
                return;
            }

            try {
                // Correct path: /payments/mpesa/...
                const response = await fetchAPI(`/payments/mpesa/status/${checkoutRequestId}`) as any;
                if (response.success && response.data.status === 'completed') {
                    setMpesaCode(response.data.mpesaReceiptNumber);
                    setMpesaTransactionDetails({
                        name: response.data.customerMessage || 'Verified Customer',
                        receipt: response.data.mpesaReceiptNumber,
                        amount: response.data.amount
                    });
                    toast.success('Payment received and verified!');
                    setIsPollingMpesa(false);
                } else if (response.success && response.data.status === 'failed') {
                    toast.error(`Payment failed: ${response.data.failureReason}`);
                    setIsPollingMpesa(false);
                } else {
                    attempts++;
                    setTimeout(poll, 3000);
                }
            } catch (error) {
                console.error('Polling error', error);
                attempts++;
                setTimeout(poll, 3000);
            }
        };

        poll();
    };

    const handleSearchPayment = async () => {
        if (!paymentAmount) {
            toast.error('Enter amount to search');
            return;
        }

        setIsProcessing(true);
        try {
            const query = new URLSearchParams({
                amount: paymentAmount,
                phone: customerPhone || '',
                limit: '5'
            }).toString();

            // Correct path: /payments/mpesa/...
            const response = await fetchAPI(`/payments/mpesa/search?${query}`) as any;

            if (response.success && response.data.length > 0) {
                // Show the latest one
                const latest = response.data[0];
                setMpesaTransactionDetails(latest);
                if (latest.receipt) {
                    setMpesaCode(latest.receipt);
                }
                toast.success('Found matching payment!');
            } else {
                toast.error('No recent matching payments found');
                setMpesaTransactionDetails(null);
            }
        } catch (error) {
            toast.error('Search failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMpesaPromptStandard = async () => {
        if (!billData || !customerPhone) {
            toast.error('Customer phone required');
            return;
        }
        setIsProcessing(true);
        try {
            const identifier = (billData.type === 'restaurant' || billData.type === 'bar') ? billData.order.order_number : billData.booking.id;
            // Correct path: /payments/mpesa/...
            const response = await fetchAPI('/payments/mpesa/initiate', {
                method: 'POST',
                body: JSON.stringify({
                    phoneNumber: customerPhone,
                    amount: parseFloat(paymentAmount),
                    bookingId: billData.type === 'hotel' ? identifier : undefined,
                    billId: billData.type === 'restaurant' || billData.type === 'bar' ? identifier : undefined,
                    accountReference: `POS-${identifier.slice(-5)}`
                })
            }) as any;

            if (response.success) {
                toast.success('STK Push sent. Waiting for payment...');
                if (response.data.checkoutRequestId) {
                    pollMpesaStatus(response.data.checkoutRequestId);
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'STK Push failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePOSTransaction = async () => {
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        setIsProcessing(true);
        const total = cart.reduce((sum, item) => sum + item.line_total, 0);
        const txId = crypto.randomUUID();

        if (isOffline) {
            const offlineTx = {
                id: txId,
                items: cart,
                total_amount: total,
                customer_name: customerName,
                customer_phone: customerPhone,
                payment_method: paymentMethod,
                created_at: new Date().toISOString(),
                synced: false
            };
            await saveOfflineTransaction(offlineTx);
            toast.success('Stored offline. Will sync when back online.');
            setCart([]);
            setIsProcessing(false);
            return;
        }

        try {
            const response = await fetchAPI('/cashier/pos/transactions', {
                method: 'POST',
                body: JSON.stringify({
                    items: cart,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    total_amount: total
                })
            }) as any;

            if (response.success) {
                toast.success('Transaction created');
                // If payment method is M-Pesa, trigger prompt
                if (paymentMethod === 'mpesa') {
                    handleMpesaPrompt(response.data.transaction_id);
                } else if (paymentMethod === 'cash') {
                    // Confirm cash immediately
                    await fetchAPI(`/cashier/pos/transactions/${response.data.transaction_id}/pay`, {
                        method: 'POST',
                        body: JSON.stringify({ method: 'CASH' })
                    });
                    toast.success('Cash payment confirmed');

                    // Manually construct receipt data to ensure it persists after cart clear
                    setSelectedTransaction({
                        ...response.data,
                        created_at: new Date().toISOString(),
                        cashier_name: 'Staff',
                        payment_method: 'CASH',
                        items: [...cart],
                        total_amount: total,
                        businessInfo: {
                            name: 'FAMOUS GATE HOTEL',
                            address: 'Kericho, Kenya',
                            phone: '+254 700 000 000',
                            email: 'info@famousgate.co.ke'
                        }
                    });
                    setShowReceipt(true);
                    setCart([]);
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Transaction failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMpesaPrompt = async (id: string) => {
        if (!customerPhone) {
            toast.error('Customer phone required for M-Pesa prompt');
            return;
        }
        setIsProcessing(true);
        try {
            const response = await fetchAPI(`/cashier/pos/transactions/${id}/pay`, {
                method: 'POST',
                body: JSON.stringify({
                    method: 'MPESA',
                    phone_number: customerPhone
                })
            }) as any;

            if (response.success) {
                toast.success('STK Push sent to customer');
                setCart([]);
            }
        } catch (error: any) {
            toast.error(error.message || 'STK Push failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleVerify = async (paymentId: string) => {
        setIsProcessing(true);
        try {
            const response = await fetchAPI(`/cashier/verify-payment/${paymentId}`, {
                method: 'POST'
            }) as any;

            if (response.success) {
                toast.success('Payment verified successfully');

                // Update local history status
                setTransactionHistory(prev => prev.map(txn =>
                    txn.id === paymentId ? { ...txn, status: 'completed' } : txn
                ));

                // Refresh bill data
                if (billData) {
                    const identifier = (billData.type === 'restaurant' || billData.type === 'bar') ? billData.order.order_number : billData.booking.id;
                    const refresh = await fetchAPI(`/cashier/bill/${identifier}`) as any;
                    if (refresh.success) {
                        setBillData(refresh.data);
                        setPaymentAmount(refresh.data.financials.balance.toString());
                    }
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Verification failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePrint = async () => {
        if (!selectedTransaction) return;

        setIsGeneratingBill(true);
        try {
            const items = selectedTransaction.items || [];
            const totalAmount = selectedTransaction.total_amount || selectedTransaction.total || 0;
            const receiptNumber = selectedTransaction.transaction_ref || selectedTransaction.receipt_number || 'POS-' + Date.now().toString().slice(-6);

            // Calculate VAT breakdown (16% included in prices)
            const vatRate = 0.16;
            const subtotal = Math.round(totalAmount / (1 + vatRate));
            const vatAmount = totalAmount - subtotal;

            const receiptData = {
                receipt_type: 'sale' as const,
                receipt_number: receiptNumber,
                date: selectedTransaction.created_at || new Date().toISOString(),
                customer_name: selectedTransaction.customer_name || 'Walk-in',
                cashier_name: selectedTransaction.cashier_name || 'Staff',
                items: items.map((item: any) => ({
                    name: item.name || item.item_name || 'Item',
                    quantity: item.qty || item.quantity || 1,
                    unit_price: item.unit_price || 0,
                    total: item.line_total || (item.unit_price * (item.qty || item.quantity || 1))
                })),
                subtotal: subtotal,
                tax_amount: vatAmount,
                total_amount: totalAmount,
                payment_method: selectedTransaction.payment_method || 'CASH',
                amount_paid: totalAmount,
                change_amount: 0,
                payment_reference: selectedTransaction.mpesa_code || undefined
            };

            const response = await receiptsAPI.generateReceipt(receiptData);

            if (response.success && response.data?.pdf_base64) {
                // Convert base64 to blob
                const byteCharacters = atob(response.data.pdf_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `receipt_${receiptNumber}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success('Receipt generated successfully');
            } else {
                throw new Error(response.message || 'Failed to generate receipt');
            }
        } catch (error: any) {
            console.error('Print error:', error);
            toast.error(error.message || 'Failed to generate receipt with Python service');
        } finally {
            setIsGeneratingBill(false);
        }
    };

    const handlePrintBill = async () => {
        if (!billData) return;

        setIsGeneratingBill(true);
        try {
            let receiptData: any = {};
            const totalAmount = billData.financials.total_amount;
            const vatRate = 0.16;
            const subtotal = Math.round(totalAmount / (1 + vatRate));
            const vatAmount = totalAmount - subtotal;

            if (billData.type === 'restaurant' || billData.type === 'bar') {
                receiptData = {
                    receipt_type: 'sale' as const,
                    receipt_number: billData.order.order_number,
                    date: billData.order.created_at || new Date().toISOString(),
                    table_number: billData.order.table_number,
                    customer_name: billData.order.guest_name || 'Walk-in',
                    cashier_name: 'Staff',
                    items: (billData.order.items || []).map((item: any) => ({
                        name: item.name,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total: item.total
                    })),
                    subtotal: subtotal,
                    tax_amount: vatAmount,
                    total_amount: totalAmount,
                    payment_method: 'PENDING',
                    amount_paid: billData.financials.amount_paid,
                    change_amount: 0
                };
            } else {
                // Hotel bill
                receiptData = {
                    receipt_type: 'invoice' as const,
                    invoice_number: billData.booking.id.slice(0, 8).toUpperCase(),
                    date: new Date().toISOString(),
                    customer_name: billData.booking.guest_name,
                    room_number: billData.booking.room_number,
                    items: [
                        {
                            description: `Room Stay (${billData.booking.room_number})`,
                            quantity: 1,
                            unit_price: billData.financials.total_amount,
                        }
                    ],
                    subtotal: subtotal,
                    tax: vatAmount,
                    amount: totalAmount,
                    notes: `Stay from ${new Date(billData.booking.check_in).toLocaleDateString()} to ${new Date(billData.booking.check_out).toLocaleDateString()}`
                };
            }

            const response = billData.type === 'hotel'
                ? await restaurantAPI.generateBill(receiptData)
                : await receiptsAPI.generateReceipt(receiptData);

            if (response.success && response.data?.pdf_base64) {
                const byteCharacters = atob(response.data.pdf_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `bill_${receiptData.receipt_number || receiptData.invoice_number}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success('Bill generated successfully');
            } else {
                throw new Error(response.message || 'Failed to generate bill');
            }
        } catch (error: any) {
            console.error('Bill error:', error);
            toast.error('Bill generation failed');
        } finally {
            setIsGeneratingBill(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.CASHIER, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT, UserRole.RECEPTIONIST]}>
            <DashboardLayout>
                {showReceipt && selectedTransaction && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <IOSCard className="p-6 bg-white max-w-sm w-full">
                            <div className="border border-dashed p-4 mb-4 bg-stone-50 rounded-lg overflow-hidden">
                                <h3 className="text-center font-bold mb-2">RECEIPT PREVIEW</h3>
                                <p className="text-center text-xs text-stone-500">A new tab will open for printing</p>
                            </div>
                            <div className="flex gap-4">
                                <IOSButton
                                    onClick={handlePrint}
                                    className="flex-1 bg-stone-900"
                                    disabled={isGeneratingBill}
                                >
                                    {isGeneratingBill ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                    Print Receipt
                                </IOSButton>
                                <IOSButton onClick={() => setShowReceipt(false)} className="flex-1 bg-stone-200 text-stone-900 border-none">Close</IOSButton>
                            </div>
                        </IOSCard>
                    </div>
                )}
                <div className="space-y-6 max-w-[1600px] mx-auto">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900">Cashier Station</h1>
                            <p className="text-stone-500 text-sm">Verify and process payments for hotel and restaurant bills</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex bg-stone-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveTab('station')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'station' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                                >
                                    Payment Station
                                </button>
                                <button
                                    onClick={() => setIsPOSType(!isPOSType)}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${isPOSType ? 'bg-orange-600 text-white shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                                >
                                    {isPOSType ? 'POS Mode (ON)' : 'POS Mode (OFF)'}
                                </button>
                                <button
                                    onClick={() => setActiveTab('logbook')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'logbook' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                                >
                                    Shift Logbook
                                </button>
                                <button
                                    onClick={() => setActiveTab('insights')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'insights' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                                >
                                    AI Insights
                                </button>
                            </div>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${isOffline ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                <div className={`w-2 h-2 rounded-full animate-pulse ${isOffline ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                {isOffline ? 'OFFLINE MODE' : 'CASHIER ONLINE'}
                            </div>
                        </div>
                    </div>

                    {activeTab === 'station' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Main Content Area */}
                            <div className="lg:col-span-2 space-y-6">

                                {/* Search Section */}
                                <IOSCard className="p-6 border-none shadow-sm bg-white">
                                    <h2 className="text-lg font-bold mb-4 text-stone-800 flex items-center gap-2">
                                        <Search size={20} className="text-orange-600" />
                                        {isPOSType ? 'Add to Cart' : 'Search Bill'}
                                    </h2>

                                    <form onSubmit={isPOSType ? handlePOSSearch : handleScan} className="flex gap-3">
                                        <div className="relative flex-1">
                                            <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                            <Input
                                                ref={inputRef}
                                                type="text"
                                                placeholder={isPOSType ? "Scan product or enter name..." : "Scan barcode or enter ID (ORD..., BAR... or HTL...)"}
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
                                            {isPOSType ? 'Add' : 'Lookup'}
                                        </IOSButton>
                                    </form>
                                </IOSCard>

                                {isPOSType && (
                                    <IOSCard className="p-6 border-none shadow-sm bg-white">
                                        <h2 className="text-lg font-bold mb-4 text-stone-800 flex items-center gap-2">
                                            <Calculator size={20} className="text-orange-600" />
                                            Cart
                                        </h2>
                                        <div className="space-y-3 mb-6">
                                            {cart.length === 0 ? (
                                                <p className="text-stone-400 text-sm italic">Cart is empty</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {cart.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-sm p-3 bg-stone-50 rounded-xl border border-stone-100 group">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-stone-800">{item.name}</span>
                                                                <span className="text-[10px] text-stone-400 font-mono">KES {item.unit_price.toLocaleString()} x {item.qty}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-black text-stone-900">KES {item.line_total.toLocaleString()}</span>
                                                                <button
                                                                    onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <Input
                                                placeholder="Customer Name"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                            />
                                            <Input
                                                placeholder="Customer Phone (e.g. 07...)"
                                                value={customerPhone}
                                                onChange={(e) => setCustomerPhone(e.target.value)}
                                            />
                                        </div>

                                        {/* M-Pesa Automation Results */}
                                        {mpesaTransactionDetails && (
                                            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between animate-in fade-in">
                                                <div>
                                                    <p className="text-[10px] font-bold text-emerald-800 uppercase">Payment Verified</p>
                                                    <p className="text-sm font-bold text-stone-900">{mpesaTransactionDetails.receipt} - {mpesaTransactionDetails.name}</p>
                                                    <p className="text-xs text-stone-500">KES {mpesaTransactionDetails.amount.toLocaleString()}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setMpesaCode(mpesaTransactionDetails.receipt);
                                                        setMpesaTransactionDetails(null);
                                                        toast.success('Reference code applied!');
                                                    }}
                                                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
                                                >
                                                    Use This
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-xl font-black mb-6">
                                            <span>Total</span>
                                            <span className="text-orange-600">
                                                KES {cart.reduce((sum, i) => sum + i.line_total, 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <IOSButton onClick={() => { setPaymentMethod('cash'); handlePOSTransaction(); }} className="bg-emerald-600">Cash Sale</IOSButton>
                                            <IOSButton onClick={() => { setPaymentMethod('mpesa'); handlePOSTransaction(); }} className="bg-orange-600">M-Pesa Prompt</IOSButton>
                                        </div>
                                    </IOSCard>
                                )}

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
                                                    onClick={handlePrintBill}
                                                    disabled={isGeneratingBill}
                                                    className="flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                                >
                                                    {isGeneratingBill ? <Loader2 className="animate-spin h-3 w-3" /> : <Printer size={14} />}
                                                    Print Bill
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
                                                <div className="space-y-4 pt-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5">Customer Phone (for STK Push)</label>
                                                        <Input
                                                            type="tel"
                                                            placeholder="e.g. 0712345678"
                                                            value={customerPhone}
                                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                                            className="h-11 bg-stone-50 border-stone-200"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1.5">M-Pesa Reference (After Payment)</label>
                                                        <div className="flex gap-2">
                                                            <Input
                                                                type="text"
                                                                placeholder="e.g. QWE123RTY (Verified automatically if online)"
                                                                value={mpesaCode}
                                                                onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                                                                className="h-11 bg-stone-50 border-stone-200 font-mono flex-1"
                                                            />
                                                            <button
                                                                onClick={handleSearchPayment}
                                                                title="Search recent payment"
                                                                className="h-11 px-3 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-600 transition-colors"
                                                            >
                                                                <Search size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <IOSButton
                                                onClick={handlePayment}
                                                disabled={isProcessing}
                                                className="w-full bg-stone-900 hover:bg-black text-white h-12 font-bold rounded-xl mt-2"
                                            >
                                                {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'Verify & Post Payment'}
                                            </IOSButton>

                                            {paymentMethod === 'mpesa' && (
                                                <IOSButton
                                                    onClick={handleMpesaPromptStandard}
                                                    disabled={isProcessing}
                                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 font-bold rounded-xl mt-2"
                                                >
                                                    {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : 'Prompt M-Pesa (STK Push)'}
                                                </IOSButton>
                                            )}

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
                    ) : activeTab === 'logbook' ? (
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
                            <CashierLogbook type="reception" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
                            {isInsightLoading && !insightsData ? (
                                <div className="col-span-2 flex items-center justify-center h-64">
                                    <Loader2 className="animate-spin text-orange-600" />
                                </div>
                            ) : (
                                <>
                                    {/* Hourly Heatmap */}
                                    <IOSCard className="p-6 bg-white min-h-[400px]">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                                <Activity size={18} className="text-orange-600" />
                                                Hourly Sales Volume
                                            </h3>
                                            <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded font-bold uppercase">Activity</span>
                                        </div>
                                        <div className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={insightsData?.hourly_heatmap || []}>
                                                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                                                    <YAxis tick={{ fontSize: 10 }} />
                                                    <Tooltip />
                                                    <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </IOSCard>

                                    {/* Forecast */}
                                    <IOSCard className="p-6 bg-white min-h-[400px]">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                                <TrendingUp size={18} className="text-blue-600" />
                                                AI Sales Forecast (7 Days)
                                            </h3>
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold uppercase">Predicted</span>
                                        </div>
                                        <div className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={forecastData?.forecasts || []}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                                    <YAxis tick={{ fontSize: 10 }} />
                                                    <Tooltip />
                                                    <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </IOSCard>

                                    {/* Top Selling Items */}
                                    <IOSCard className="p-6 bg-white lg:col-span-2">
                                        <div className="flex items-center mb-6">
                                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                                <TrendingUp size={18} className="text-emerald-600" />
                                                Sales Velocity (Popular Items)
                                            </h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {insightsData?.top_items?.map((item: any, idx: number) => (
                                                <div key={idx} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">{item.name || 'Item'}</p>
                                                        <p className="text-lg font-black text-stone-900">{item.qty} Sales</p>
                                                    </div>
                                                    <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                                                        <Activity size={20} className="text-emerald-500" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </IOSCard>

                                    {/* Stock Health */}
                                    <IOSCard className="p-6 bg-white lg:col-span-2">
                                        <div className="flex items-center mb-6">
                                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                                <AlertTriangle size={18} className="text-rose-600" />
                                                Stock Health Prediction
                                            </h3>
                                        </div>
                                        {stockAlerts && stockAlerts.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {stockAlerts.filter((i: any) => i.status !== 'stable').map((item: any, idx: number) => (
                                                    <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between ${item.status === 'critical' ? 'bg-rose-50 border-rose-100' : 'bg-orange-50 border-orange-100'
                                                        }`}>
                                                        <div>
                                                            <p className="text-xs text-stone-900 font-black uppercase tracking-wider mb-1">{item.item_name}</p>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-stone-500">Left: {item.current_stock}</span>
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${item.status === 'critical' ? 'bg-rose-200 text-rose-800' : 'bg-orange-200 text-orange-800'
                                                                    }`}>
                                                                    ~{Math.ceil(item.days_remaining)} Days
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className={`h-10 w-10 rounded-xl shadow-sm flex items-center justify-center ${item.status === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'
                                                            }`}>
                                                            <AlertTriangle size={20} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-stone-400 text-sm">
                                                All inventory levels look healthy based on current sales velocity.
                                            </div>
                                        )}
                                    </IOSCard>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute >
    );
}

export default function CashierPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-stone-400">Loading Station...</div>}>
            <CashierPageContent />
        </Suspense>
    );
}
