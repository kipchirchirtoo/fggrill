'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    CheckCircle, XCircle, Search, AlertCircle, Receipt, Clock,
    User, DollarSign, CreditCard, Scan, Printer, Loader2,
    Banknote, AlertTriangle, Layout, Calculator, BarChart3, TrendingUp, Activity,
    Shield, ArrowRight, FileSpreadsheet, RefreshCw, Plus
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { CashierModals } from '@/components/modals/CashierModals';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, LineChart, Line, AreaChart, Area
} from 'recharts';
import { toast } from 'sonner';
import { fetchAPI, financeAPI, auditAPI } from '@/lib/api';
import { PYTHON_API_URL } from '@/lib/config';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { IOSCard } from '@/components/ui/ios-card';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { format } from 'date-fns';

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

function BarCashierContent() {
    const router = useRouter();
    const { user } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab') as any;

    // Financial Profile State (Same as BranchAccountingDashboard)
    const [financials, setFinancials] = useState<any>(null);
    const [rejectedLogbooks, setRejectedLogbooks] = useState<any[]>([]);
    const [isProfileLoading, setIsProfileLoading] = useState(false);

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
    const [showDynamicBillModal, setShowDynamicBillModal] = useState(false);
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

    const currentBranchId = activeBranchId || user?.branch_id;

    const fetchProfileData = useCallback(async () => {
        if (!currentBranchId) return;
        setIsProfileLoading(true);
        try {
            const profileRes = await financeAPI.getBranchFinancials(currentBranchId);
            if (profileRes.success) {
                setFinancials(profileRes.data);
                // Specifically filter for bar rejections for this user
                setRejectedLogbooks(profileRes.data.logbooks?.filter((l: any) => l.status === 'rejected' && l.type === 'bar') || []);
            }
        } catch (error) {
            console.error('Error fetching bar financial profile:', error);
        } finally {
            setIsProfileLoading(false);
        }
    }, [currentBranchId]);

    useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData]);

    useEffect(() => {
        inputRef.current?.focus();

        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setIsOffline(!navigator.onLine);

        if (!isOffline) {
            syncOfflineTransactions();
            syncProducts();
        }

        if (activeTab === 'insights') {
            fetchInsights();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isOffline, activeTab]);

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
                    barcode: item.id,
                    sku: item.id,
                    category: item.category_id
                }));
                await cacheProducts(products);
            }
        } catch (error) {
            console.error('Failed to sync products', error);
        }
    };

    const handlePOSSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const query = scanInput.trim();
        if (!query) return;

        const results = await searchProductsOffline(query);

        if (results.length > 0) {
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
                        cashier_name: user ? `${user.firstName} ${user.lastName}` : 'Bar Cashier',
                        total_amount: amount,
                        payment_method: paymentMethod,
                        items: billData.order?.items || []
                    });
                    setShowReceipt(true);
                }

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

                const refresh = await fetchAPI(`/cashier/bill/${identifier}`) as any;
                if (refresh.success) {
                    setBillData(refresh.data);
                    setPaymentAmount(refresh.data.financials.balance.toString());
                    setMpesaCode('');
                }

                // Refresh financial profile
                fetchProfileData();
            }
        } catch (error: any) {
            toast.error(error.message || 'Payment failed');
        } finally {
            setIsProcessing(false);
        }
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

            const response = await fetchAPI(`/payments/mpesa/search?${query}`) as any;

            if (response.success && response.data.length > 0) {
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
            const response = await fetchAPI('/payments/mpesa/initiate', {
                method: 'POST',
                body: JSON.stringify({
                    phoneNumber: customerPhone,
                    amount: parseFloat(paymentAmount),
                    bookingId: billData.type === 'hotel' ? identifier : undefined,
                    billId: billData.type === 'restaurant' || billData.type === 'bar' ? identifier : undefined,
                    accountReference: `BAR-${identifier.slice(-5)}`
                })
            }) as any;

            if (response.success) {
                toast.success('STK Push sent. Waiting for payment...');
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
                if (paymentMethod === 'cash') {
                    await fetchAPI(`/cashier/pos/transactions/${response.data.transaction_id}/pay`, {
                        method: 'POST',
                        body: JSON.stringify({ method: 'CASH' })
                    });
                    toast.success('Cash payment confirmed');

                    setSelectedTransaction({
                        custom_ref: response.data.reference, // avoid overwriting actual ID
                        created_at: new Date().toISOString(),
                        cashier_name: user ? `${user.firstName} ${user.lastName}` : 'Bar Cashier',
                        payment_method: 'CASH',
                        items: [...cart],
                        total_amount: response.data.total_amount
                    });
                    setShowReceipt(true);
                    setCart([]);
                    fetchProfileData();
                } else if (paymentMethod === 'mpesa') {
                    // Trigger MPESA prompt
                    const prompt = await fetchAPI(`/cashier/pos/transactions/${response.data.transaction_id}/pay`, {
                        method: 'POST',
                        body: JSON.stringify({
                            method: 'MPESA',
                            phone_number: customerPhone
                        })
                    }) as any;
                    if (prompt.success) {
                        toast.success('STK Push sent to customer');
                        setCart([]);
                    }
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Transaction failed');
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
                setTransactionHistory(prev => prev.map(txn =>
                    txn.id === paymentId ? { ...txn, status: 'completed' } : txn
                ));
                fetchProfileData();
            }
        } catch (error: any) {
            toast.error(error.message || 'Verification failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePrint = () => {
        if (!selectedTransaction) return;
        const printWindow = window.open('', '', 'width=600,height=600');
        if (!printWindow) return;

        const items = selectedTransaction.items || [];
        const businessInfo = {
            name: 'FG BAR & LOUNGE',
            address: 'Main Branch',
            phone: '0700 000 000',
            pin: 'P051234567X'
        };

        const totalAmount = selectedTransaction.total_amount || 0;
        const subtotal = totalAmount / 1.16;
        const tax = totalAmount - subtotal;
        const receiptNumber = selectedTransaction.transaction_id || 'N/A';

        const receiptHTML = `
            <html>
            <head>
                <title>Bar Receipt</title>
                <style>
                    body { font-family: monospace; padding: 20px; }
                    .receipt { width: 80mm; margin: 0 auto; font-size: 10px; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th, td { text-align: left; padding: 2px 0; }
                    .text-right { text-align: right; }
                    .border-top { border-top: 1px dashed black; padding-top: 5px; }
                    .barcode-container { margin-top: 10px; text-align: center; }
                    #barcode { width: 100%; max-width: 200px; }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            </head>
            <body>
                <div class="receipt">
                    <div class="center">
                        <h1 class="bold">${businessInfo.name}</h1>
                        <p>${businessInfo.address}</p>
                        <p>Tel: ${businessInfo.phone}</p>
                        <p>BAR RECEIPT</p>
                    </div>
                    <div class="border-top" style="margin: 10px 0;">
                        <p>Receipt #: ${receiptNumber}</p>
                        <p>Date: ${new Date().toLocaleString()}</p>
                        <p>Cashier: ${selectedTransaction.cashier_name || 'Staff'}</p>
                    </div>
                    <table>
                        <thead>
                            <tr style="border-bottom: 1px solid black;">
                                <th>Item</th>
                                <th class="text-right">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map((item: any) => `
                                <tr>
                                    <td>${item.name} x${item.qty || 1}</td>
                                    <td class="text-right">${(item.line_total || item.total || 0).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="border-top">
                        <div style="display: flex; justify-content: space-between;">
                            <span>TOTAL:</span>
                            <span class="bold">KES ${totalAmount.toLocaleString()}</span>
                        </div>
                        <p style="margin-top: 5px;">Payment: ${selectedTransaction.payment_method || 'CASH'}</p>
                    </div>
                    <div class="center" style="margin-top: 20px;">
                        <p>THANK YOU - CHEERS!</p>
                        <div class="barcode-container">
                            <svg id="barcode"></svg>
                        </div>
                    </div>
                </div>
                <script>
                    try {
                        const barcodeVal = "${selectedTransaction.id || selectedTransaction.billNo || receiptNumber}";
                        JsBarcode("#barcode", barcodeVal, {
                            format: "CODE128",
                            width: 1.5,
                            height: 40,
                            displayValue: false
                        });
                    } catch (e) { console.error("Barcode error", e); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(receiptHTML);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.CASHIER, UserRole.SUPER_ADMIN, UserRole.BARTENDER, UserRole.BRANCH_MANAGER]}>
            <DashboardLayout>
                {showReceipt && selectedTransaction && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <IOSCard className="p-6 bg-white max-w-sm w-full">
                            <div className="border border-dashed p-4 mb-4 bg-stone-50 rounded-lg text-center">
                                <h3 className="font-bold">RECEIPT READY</h3>
                                <p className="text-xs text-stone-500">Preview and print bar receipt</p>
                            </div>
                            <div className="flex gap-4">
                                <IOSButton onClick={handlePrint} className="flex-1 bg-stone-900 text-white">Print</IOSButton>
                                <IOSButton onClick={() => setShowReceipt(false)} className="flex-1 bg-stone-200 text-stone-900 border-none">Close</IOSButton>
                            </div>
                        </IOSCard>
                    </div>
                )}

                <div className="space-y-6 max-w-[1600px] mx-auto">
                    {/* Header with Stats Highlights */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900">Bar Cashier Station</h1>
                            <p className="text-stone-500 text-sm">{activeBranch?.name || 'Bar Operations' && 'Process bar bills, manage logs, and view insights.'}</p>
                        </div>

                        <div className="flex items-center gap-3">
                            {financials && (
                                <div className="hidden lg:flex items-center gap-4 bg-stone-50 px-4 py-2 rounded-2xl border border-stone-100">
                                    <div className="text-right border-r border-stone-200 pr-4">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Today Bar Revenue</p>
                                        <p className="text-sm font-black text-emerald-600">KES {(financials.summary?.breakdown?.bar || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Net Margin</p>
                                        <p className="text-sm font-black text-stone-900">{financials.summary?.profitMargin?.toFixed(1)}%</p>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => setShowDynamicBillModal(true)}
                                className="px-4 py-2 bg-orange-50 text-orange-700 rounded-xl flex items-center gap-2 border border-orange-100 font-bold hover:bg-orange-100 transition-all shadow-sm text-xs"
                            >
                                <Plus size={16} />
                                Create General Bill
                            </button>

                            <div className="flex bg-stone-100 p-1 rounded-xl">
                                <button
                                    onClick={() => setActiveTab('station')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'station' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                                >
                                    Payments
                                </button>
                                <button
                                    onClick={() => setActiveTab('logbook')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'logbook' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                                >
                                    Logbook
                                </button>
                                <button
                                    onClick={() => setActiveTab('insights')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'insights' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}
                                >
                                    Insights
                                </button>
                            </div>

                            <button onClick={fetchProfileData} className="p-2 bg-stone-100 rounded-lg hover:bg-stone-200">
                                <RefreshCw size={16} className={isProfileLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {activeTab === 'station' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-6">
                                <IOSCard className="p-6 border-none shadow-sm bg-white">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                                            <Search size={20} className="text-orange-600" />
                                            {isPOSType ? 'Add Item' : 'Lookup Bar Bill'}
                                        </h2>
                                        <label className="flex items-center gap-2 cursor-pointer bg-stone-100 px-3 py-1 rounded-full">
                                            <span className="text-[10px] font-bold text-stone-500 uppercase">POS Mode</span>
                                            <input type="checkbox" checked={isPOSType} onChange={e => setIsPOSType(e.target.checked)} className="h-3 w-3 accent-orange-600" />
                                        </label>
                                    </div>

                                    <form onSubmit={isPOSType ? handlePOSSearch : handleScan} className="flex gap-3">
                                        <div className="relative flex-1">
                                            <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                            <Input
                                                ref={inputRef}
                                                placeholder={isPOSType ? "Search drinks/snacks..." : "Enter Order # (e.g. BAR-123)"}
                                                value={scanInput}
                                                onChange={e => setScanInput(e.target.value)}
                                                className="pl-10 h-11 bg-stone-50 border-stone-200"
                                            />
                                        </div>
                                        <IOSButton type="submit" disabled={isLoading} className="bg-orange-600 text-white h-11 px-6">
                                            {isLoading ? <Loader2 className="animate-spin" /> : 'Search'}
                                        </IOSButton>
                                    </form>
                                </IOSCard>

                                {isPOSType && cart.length > 0 && (
                                    <IOSCard className="p-6 bg-white animate-in slide-in-from-top-2">
                                        <h3 className="font-bold mb-4 flex items-center gap-2">
                                            <Calculator size={18} /> Current Cart
                                        </h3>
                                        <div className="space-y-2 mb-6">
                                            {cart.map((item, i) => (
                                                <div key={i} className="flex justify-between items-center p-2 bg-stone-50 rounded-lg">
                                                    <span className="text-sm">{item.name} x{item.qty}</span>
                                                    <span className="font-bold">KES {item.line_total.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input placeholder="Guest Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                                            <Input placeholder="Guest Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                                        </div>
                                        <div className="flex justify-between items-center mt-6 pt-4 border-t">
                                            <span className="font-bold">Total</span>
                                            <span className="text-xl font-black text-orange-600">KES {cart.reduce((s, i) => s + i.line_total, 0).toLocaleString()}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <IOSButton onClick={() => { setPaymentMethod('cash'); handlePOSTransaction(); }} className="bg-emerald-600 text-white">Cash Sale</IOSButton>
                                            <IOSButton onClick={() => { setPaymentMethod('mpesa'); handlePOSTransaction(); }} className="bg-black text-white">M-Pesa STK</IOSButton>
                                        </div>
                                    </IOSCard>
                                )}

                                {billData && (
                                    <IOSCard className="p-6 bg-white animate-in fade-in">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h2 className="text-xl font-bold">Bill Summary</h2>
                                                <p className="text-sm text-stone-500">{billData.order?.guest_name || 'Guest'} - Table {billData.order?.table_number || 'N/A'}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${billData.financials?.balance > 0 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                {billData.financials?.balance > 0 ? 'Unpaid' : 'Cleared'}
                                            </span>
                                        </div>

                                        <div className="bg-stone-900 text-white p-6 rounded-2xl space-y-3">
                                            <div className="flex justify-between opacity-70">
                                                <span>Subtotal</span>
                                                <span>KES {billData.financials?.total_amount.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-emerald-400">
                                                <span>Paid So Far</span>
                                                <span>- KES {billData.financials?.amount_paid.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xl font-black pt-3 border-t border-stone-800">
                                                <span>Balance</span>
                                                <span className="text-orange-500">KES {billData.financials?.balance.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </IOSCard>
                                )}
                            </div>

                            <div className="space-y-6">
                                {billData && billData.financials?.balance > 0 && (
                                    <IOSCard className="p-6 bg-white">
                                        <h3 className="font-bold mb-4">Post Payment</h3>
                                        <div className="space-y-4">
                                            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full h-11 bg-stone-50 border rounded-xl px-3 font-medium">
                                                <option value="cash">Cash</option>
                                                <option value="mpesa">M-Pesa</option>
                                                <option value="card">Bank Card</option>
                                            </select>
                                            <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="font-bold text-lg" />
                                            {paymentMethod === 'mpesa' && (
                                                <>
                                                    <Input placeholder="Guest Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                                                    <div className="flex gap-2">
                                                        <Input placeholder="M-Pesa Code" value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())} className="flex-1 font-mono" />
                                                        <button onClick={handleSearchPayment} className="p-3 bg-stone-100 rounded-xl hover:bg-stone-200"><Search size={18} /></button>
                                                    </div>
                                                </>
                                            )}
                                            <IOSButton onClick={handlePayment} disabled={isProcessing} className="w-full bg-stone-900 text-white h-12 rounded-xl">
                                                {isProcessing ? <Loader2 className="animate-spin" /> : 'Confirm Payment'}
                                            </IOSButton>
                                        </div>
                                    </IOSCard>
                                )}

                                <IOSCard className="p-6 bg-white">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <Clock size={18} /> Recent Shifts
                                    </h3>
                                    <div className="space-y-3">
                                        {transactionHistory.slice(0, 5).map((tx, idx) => (
                                            <div key={idx} className="p-3 bg-stone-50 rounded-xl flex justify-between items-center group">
                                                <div>
                                                    <p className="text-xs font-bold truncate max-w-[120px]">{tx.customerName}</p>
                                                    <p className="text-[10px] text-stone-400 capitalize">{tx.paymentMethod} • {tx.status}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-emerald-600">KES {tx.amount.toLocaleString()}</p>
                                                    {tx.status === 'pending' && <button onClick={() => handleVerify(tx.id)} className="text-[9px] font-bold text-orange-600 hover:underline">Verify</button>}
                                                </div>
                                            </div>
                                        ))}
                                        {transactionHistory.length === 0 && <p className="text-center py-6 text-stone-400 text-xs">No recent activity</p>}
                                    </div>
                                </IOSCard>
                            </div>
                        </div>
                    ) : activeTab === 'logbook' ? (
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
                            <CashierLogbook type="bar" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                            {isInsightLoading ? (
                                <div className="col-span-2 py-20 text-center"><Loader2 className="animate-spin mx-auto text-orange-600" /></div>
                            ) : (
                                <>
                                    <IOSCard className="p-6 bg-white">
                                        <h3 className="font-bold mb-6 flex items-center gap-2"><Activity size={18} className="text-orange-500" /> Bar Sales Heatmap</h3>
                                        <div className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={insightsData?.hourly_heatmap || []}>
                                                    <XAxis dataKey="hour" hide />
                                                    <Tooltip />
                                                    <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </IOSCard>
                                    <IOSCard className="p-6 bg-white">
                                        <h3 className="font-bold mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-blue-500" /> 7-Day Forecast</h3>
                                        <div className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={forecastData?.forecasts || []}>
                                                    <XAxis dataKey="date" hide />
                                                    <Tooltip />
                                                    <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#dbeafe" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </IOSCard>
                                </>
                            )}
                        </div>
                    )}

                    {/* Action Required Section (Same as Branch Dashboard) */}
                    {rejectedLogbooks.length > 0 && (
                        <div className="card-elevated p-6 border-l-4 border-l-rose-500 bg-rose-50/30">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[16px] font-bold text-rose-900 flex items-center gap-2">
                                    <Shield className="h-5 w-5" /> Action Required: Audit Rejections
                                </h3>
                                <span className="bg-rose-500 text-white px-3 py-0.5 rounded-full text-[10px] font-bold">
                                    {rejectedLogbooks.length} REJECTED
                                </span>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {rejectedLogbooks.map((log) => (
                                    <div key={log.id} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm group hover:border-rose-300 transition-all flex flex-col justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                                                <AlertTriangle size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-stone-900">
                                                    Bar Log - {format(new Date(log.log_date), 'MMM d, yyyy')}
                                                </p>
                                                <p className="text-xs text-rose-600 font-medium mt-1 italic">
                                                    "{log.audit_notes || 'No notes provided by auditor'}"
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            className="mt-4 w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                                            onClick={() => setActiveTab('logbook')}
                                        >
                                            Fix & Resubmit <ArrowRight size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <AnimatePresence mode="wait">
                    {showDynamicBillModal && (
                        <CashierModals.CreateDynamicBillModal
                            isOpen={showDynamicBillModal}
                            onClose={() => setShowDynamicBillModal(false)}
                            onSuccess={() => {
                                setShowDynamicBillModal(false);
                            }}
                        />
                    )}
                </AnimatePresence>
            </DashboardLayout >
        </ProtectedRoute >
    );
}

export default function BarCashierPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-stone-400">Loading Bar Station...</div>}>
            <BarCashierContent />
        </Suspense>
    );
}
