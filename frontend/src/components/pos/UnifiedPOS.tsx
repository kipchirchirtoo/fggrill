'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { restaurantAPI, barAPI, staffAPI, receiptsAPI } from '@/lib/api';
import { printHtml as printHtmlHelper } from '@/lib/tauri-print';
import { toast } from 'sonner';
import {
    Search, ChefHat, Plus, Minus, X, ShoppingCart,
    UtensilsCrossed, Wine, FileText, RefreshCw,
    WineIcon, ConciergeBell, History, Layers, Check,
    AlertCircle, Info, Trash2, User as UserIcon,
    Grid, List, ChevronDown, ArrowRight, LogOut, Bell
} from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface MenuItem {
    id: string;
    name: string;
    price: number;
    category_id: string;
    image_url?: string;
    is_available: boolean;
    category?: { name: string };
}

interface Category {
    id: string;
    name: string;
}

interface CartItem extends MenuItem {
    quantity: number;
    notes?: string;
}


interface UnifiedPOSProps {
    mode: 'restaurant' | 'bar';
    onOrderCreated?: () => void;
}

export function UnifiedPOS({ mode, onOrderCreated }: UnifiedPOSProps) {
    const { user, logout } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();
    const currentBranchId = activeBranchId || user?.branch_id;

    // Theme values
    const isRestaurant = mode === 'restaurant';
    const accentColor = isRestaurant ? 'amber' : 'indigo';
    const accentHex = isRestaurant ? '#f59e0b' : '#6366f1';
    const accentBg = isRestaurant ? 'bg-amber-500' : 'bg-indigo-600';
    const accentText = isRestaurant ? 'text-amber-600' : 'text-indigo-600';
    const accentLightBg = isRestaurant ? 'bg-amber-50' : 'bg-indigo-50';
    const accentBorder = isRestaurant ? 'border-amber-200' : 'border-indigo-200';

    // Menu state
    const [items, setItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Cart state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);

    // Restaurant specific state
    const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'room_service'>('dine_in');
    const [tableNumber, setTableNumber] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    const [customerName, setCustomerName] = useState('');

    // Bar specific state
    const [openTabs, setOpenTabs] = useState<any[]>([]);
    const [selectedTabId, setSelectedTabId] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [isPrinting, setIsPrinting] = useState<string | null>(null);

    // History State
    const [historyDate, setHistoryDate] = useState<Date>(new Date());
    const [historyStatus, setHistoryStatus] = useState<string>('all'); // 'all', 'pending', 'completed', 'cancelled'
    const [waiterFilter, setWaiterFilter] = useState<string>('my-orders'); // 'my-orders' or 'all-orders'
    const [isVoiding, setIsVoiding] = useState<string | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

    const toggleOrderExpansion = (orderId: string) => {
        setExpandedOrders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) {
                newSet.delete(orderId);
            } else {
                newSet.add(orderId);
            }
            return newSet;
        });
    };

    const filteredOrders = useMemo(() => {
        return recentOrders.filter(order => {
            // 1. Filter by Date (comparing YYYY-MM-DD)
            const orderDate = new Date(order.created_at);
            const isSameDate = orderDate.toDateString() === historyDate.toDateString();

            // 2. Filter by Status
            let matchesStatus = false;
            if (historyStatus === 'all') {
                matchesStatus = true;
            } else if (historyStatus === 'pending') {
                matchesStatus = order.status === 'pending' || order.status === 'kitchen_ready';
            } else if (historyStatus === 'completed') {
                matchesStatus = order.status === 'completed' || order.status === 'paid' || order.status === 'delivered' || order.status === 'served' || order.status === 'ready';
            } else if (historyStatus === 'cancelled') {
                matchesStatus = order.status === 'cancelled' || order.status === 'voided';
            }

            // 3. Filter by Waiter (My Orders vs All Orders)
            let matchesWaiter = true;
            if (waiterFilter === 'my-orders') {
                // Show only orders created by this user
                matchesWaiter = order.created_by === user?.id || order.waiter_id === user?.id;
            }
            // If 'all-orders', show all orders (matchesWaiter stays true)

            return isSameDate && matchesStatus && matchesWaiter;
        });
    }, [recentOrders, historyDate, historyStatus, waiterFilter, user?.id]);

    const handleVoidOrder = async () => {
        if (!isVoiding || !voidReason.trim()) return;

        try {
            // Use the new void request endpoint for accountant approval
            const res = await fetch('/api/restaurant/orders/' + isVoiding + '/void-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: voidReason })
            });

            const data = await res.json();

            if (data.success) {
                toast.success('Void request submitted for accountant approval');
                setIsVoiding(null);
                setVoidReason('');
                setVoidConfirmOpen(false);
                fetchData(); // Refresh list
            } else {
                toast.error('Failed to submit void request');
            }
        } catch (error) {
            console.error('Void error', error);
            toast.error('Error submitting void request');
        }
    };

    const handleEditOrder = async (order: any) => {
        // Populate the table number if it exists
        if (order.table_number) {
            setTableNumber(order.table_number);
        }
        
        // Populate room number if it exists
        if (order.room_number) {
            setRoomNumber(order.room_number);
            setOrderType('room_service');
        }
        
        // Populate customer name if it exists
        if (order.guest_name || order.customer_name) {
            setCustomerName(order.guest_name || order.customer_name);
        }
        
        // Set order type if available
        if (order.order_type) {
            setOrderType(order.order_type);
        }

        // Store the order ID for later use when submitting
        sessionStorage.setItem('editing_order_id', order.id);
        
        // CRITICAL FIX: Don't load existing items into cart
        // This prevents duplication - only NEW items added by user will be sent to addItemsToOrder
        setCart([]);
        setShowHistory(false);
        toast.info('Add new items to this order. Only new items will be added.');
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Calculate date range for the selected history date
            const startOfDay = new Date(historyDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(historyDate);
            endOfDay.setHours(23, 59, 59, 999);

            const dateParams = {
                from_date: startOfDay.toISOString(),
                to_date: endOfDay.toISOString()
            };

            if (isRestaurant) {
                const [itemsRes, categoriesRes] = await Promise.all([
                    restaurantAPI.getMenuItems(undefined, currentBranchId || undefined, true),
                    restaurantAPI.getCategories(currentBranchId || undefined, true)
                ]);

                if (itemsRes.success) setItems(itemsRes.data || []);
                if (categoriesRes.success) setCategories(categoriesRes.data || []);
            } else {
                const [drinksRes, categoriesRes, tabsRes] = await Promise.all([
                    barAPI.getDrinks(undefined, currentBranchId || undefined, true),
                    barAPI.getCategories(currentBranchId || undefined, true),
                    barAPI.getTabs(currentBranchId || undefined, 'open')
                ]);

                if (drinksRes.success) setItems(drinksRes.data || []);
                if (categoriesRes.success) {
                    setCategories(categoriesRes.data || []);
                }
                if (tabsRes.success) setOpenTabs(tabsRes.data || []);
            }

            // Fetch recent orders for history with date filter - only current user's orders
            if (user?.id) {
                // console.log('[UnifiedPOS] Fetching orders for user:', user.id, 'branch:', currentBranchId, 'date:', startOfDay.toISOString().split('T')[0]);
                const ordersRes = isRestaurant
                    ? await restaurantAPI.getMyOrders(user.id, Number(currentBranchId) || undefined, {
                        from_date: startOfDay.toISOString().split('T')[0],
                        to_date: endOfDay.toISOString().split('T')[0]
                    })
                    : await barAPI.getOrders({
                        branchId: Number(currentBranchId) || undefined,
                        ...dateParams
                    });

                // console.log('[UnifiedPOS] Orders fetch result:', ordersRes.success, 'count:', ordersRes.data?.length || 0);
                if (ordersRes.success) {
                    setRecentOrders(ordersRes.data || []);
                }
            } else {
                // console.warn('[UnifiedPOS] No user ID available for fetching orders');
            }
        } catch (error) {
            console.error(`Error fetching ${mode} data:`, error);
            toast.error(`Failed to load ${mode} menu`);
        } finally {
            setIsLoading(false);
        }
    }, [mode, currentBranchId, isRestaurant, historyDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addToCart = (item: MenuItem) => {
        setCart((prev) => {
            const existing = prev.find((i) => i.id === item.id);
            if (existing) return prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...item, quantity: 1 }];
        });
        setLastAddedId(item.id);
        setTimeout(() => setLastAddedId(null), 500);
    };

    const updateQuantity = (itemId: string, delta: number) => {
        setCart((prev) => prev.map((item) => {
            if (item.id === itemId) {
                const newQty = item.quantity + delta;
                return newQty > 0 ? { ...item, quantity: newQty } : item;
            }
            return item;
        }).filter((item) => item.quantity > 0));
    };

    const removeFromCart = (itemId: string) => setCart((prev) => prev.filter((i) => i.id !== itemId));
    const clearCart = () => {
        setCart([]);
        setTableNumber('');
        setRoomNumber('');
        setCustomerName('');
        setSelectedTabId('');
    };

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesCategory = selectedCategoryId === 'all' || item.category_id === selectedCategoryId;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch && item.is_available;
        });
    }, [items, selectedCategoryId, searchQuery]);

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const subtotal = Math.round(total / 1.16);
    const tax = total - subtotal;

    const handlePrintReceipt = async (orderData: any) => {
        // Debug user object
        // console.log('[Bill] User object:', user);
        // console.log('[Bill] firstName:', user?.firstName, 'first_name:', user?.first_name);
        // console.log('[Bill] lastName:', user?.lastName, 'last_name:', user?.last_name);

        // Desktop App Native Printing Intercept
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            try {
                const printType = (orderData.status === 'pending' || orderData.status === 'kitchen_ready')
                    ? 'pos:printProforma'
                    : 'pos:printReceipt';

                const res = await (window as any).electronAPI.invoke(printType, {
                    ...orderData,
                    branch: activeBranch,
                    user: {
                        firstName: user?.firstName || user?.first_name || '',
                        lastName: user?.lastName || user?.last_name || ''
                    }
                });

                if (res.success) {
                    toast.success('Sent to printer');
                    return;
                }
            } catch (e) {
                // console.warn('Native printing failed, falling back to window.print', e);
            }
        }

        setIsPrinting(orderData.id);

        try {
            const receiptNumber = orderData.order_number || orderData.id?.substring(0, 8);
            const dateStr = new Date(orderData.created_at || new Date()).toLocaleString();
            const items = (orderData.items || []).map((item: any) => ({
                name: item.name || item.menu_item?.name || 'Unknown Item',
                quantity: item.quantity,
                unit_price: item.unit_price || item.price,
                total: (item.unit_price || item.price) * item.quantity
            }));
            const totalAmount = orderData.total || orderData.total_amount;
            const b = activeBranch || { name: 'Famous Gates Hotels', location: 'Bomet, Kenya', settings: { phone: '0706782828', pin: '', email: 'famousgatesbmt@gmail.com' } };
            const companyName = 'FAMOUSGATE HOTELS';
            const companyBranch = b.name && b.name.toUpperCase() !== 'FAMOUSGATE HOTELS' && b.name.toUpperCase() !== 'FAMOUS GATE HOTELS' && b.name.toUpperCase() !== 'FAMOUS GATES HOTELS' ? b.name.toUpperCase() : '';
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
                        <script>
                            // Fallback for offline if script fails to load
                            window.addEventListener('error', function(e) {
                                if (e.target.src && e.target.src.includes('jsbarcode')) {
                                    // console.warn('JsBarcode failed to load - likely offline');
                                    window.jsBarcodeError = true;
                                }
                            }, true);
                        </script>
                    </head>
                    <body>
                        <div class="center">
                            <!-- Logo Placeholder - matches Python's logic -->
                            <div style="margin-bottom: 5px;">
                                <img src="/fglogo.png" style="width: 24mm; height: 24mm; object-fit: contain;" onerror="this.style.display='none'">
                            </div>
                            <div class="bold header-title">${companyName}</div>
                            ${companyBranch ? `<div>${companyBranch}</div>` : ''}
                            <div>${companyAddress}</div>
                            <div>Tel: ${companyPhone}</div>
                            <div class="bold receipt-type">${(orderData.status === 'pending' || orderData.status === 'kitchen_ready' ? 'PROFORMA BILL' : (orderData.receipt_type || 'CASH RECEIPT')).toUpperCase()}</div>
                        </div>

                        <div class="dashed-line"></div>

                        <div style="font-size: 8px;">
                            <div class="flex"><span>Receipt #: ${receiptNumber}</span></div>
                            <div class="flex"><span>Date: ${dateStr}</span></div>
                            ${orderData.table_number ? `<div class="flex"><span>Table: ${orderData.table_number}</span></div>` : ''}
                            ${orderData.room_number ? `<div class="flex"><span>Room: ${orderData.room_number}</span></div>` : ''}
                            ${orderData.customer_name ? `<div class="flex"><span>Customer: ${orderData.customer_name}</span></div>` : ''}
                            <div class="flex"><span>Served by: ${user?.firstName || user?.first_name || ''} ${user?.lastName || user?.last_name || ''}</span></div>
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
                                <span>KES ${Math.round(totalAmount / 1.16).toLocaleString()}</span>
                            </div>
                            <div class="flex">
                                <span>TAX (16% incl.)</span>
                                <span>KES ${Math.round(totalAmount - (totalAmount / 1.16)).toLocaleString()}</span>
                            </div>
                            <div class="flex bold final-total">
                                <span>TOTAL:</span>
                                <span>KES ${totalAmount.toLocaleString()}</span>
                            </div>
                        </div>

                        <div style="margin-top: 10px; font-size: 8px;">
                            <div class="flex"><span>Payment: ${orderData.status === 'pending' || orderData.status === 'kitchen_ready' ? 'PAYMENT DUE' : (orderData.payment_method || paymentMethod).toUpperCase()}</span></div>
                            <div class="flex"><span>${orderData.status === 'pending' || orderData.status === 'kitchen_ready' ? 'Amount Due' : 'Paid'}: KES ${totalAmount.toLocaleString()}</span></div>
                            ${orderData.status === 'pending' || orderData.status === 'kitchen_ready' ? '' : '<div class="flex"><span>Change: KES 0</span></div>'}
                        </div>

                        <div class="dashed-line"></div>

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
                                        const barcodeValue = "${orderData.order_number || orderData.id}";
                                        JsBarcode("#barcode", barcodeValue, {
                                            format: "CODE128",
                                            width: 1.5,
                                            height: 35,
                                            displayValue: true,
                                            fontSize: 10,
                                            margin: 5
                                        });
                                    } else {
                                        document.getElementById('barcode').style.display = 'none';
                                    }
                                } catch(e) { 
                                    console.error("Barcode error:", e);
                                    document.getElementById('barcode').style.display = 'none';
                                }

                                window.focus();
                                setTimeout(() => { 
                                    window.print();
                                    setTimeout(() => { window.close(); }, 500);
                                }, 800);
                            };
                        </script>
                    </body>
                </html>
            `;

            printHtmlHelper(receiptHtml, { width: 450, height: 600, title: `Receipt ${receiptNumber}` });
        } catch (e) {
            console.error('Print Error:', e);
            toast.error('Printing failed.');
        } finally {
            setIsPrinting(null);
        }
    };

    const handleCreateOrder = async () => {
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Check if we're editing an existing order
            const editingOrderId = sessionStorage.getItem('editing_order_id');
            
            if (editingOrderId) {
                // We're editing an existing order - add items to it
                const items = cart.map(item => ({
                    menu_item_id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.price,
                    price: item.price,
                    notes: item.notes,
                }));
                
                const res = await restaurantAPI.addItemsToOrder(editingOrderId, items);
                
                if (res.success) {
                    toast.success('Order updated successfully!');
                    sessionStorage.removeItem('editing_order_id');
                    clearCart();
                    onOrderCreated?.();
                    fetchData(); // Refresh history
                } else {
                    throw new Error(res.message || 'Failed to update order');
                }
                
                setIsSubmitting(false);
                return;
            }
            
            // Normal order creation flow
            if (isRestaurant) {
                if (orderType === 'dine_in' && !tableNumber) {
                    toast.error('Please enter table number');
                    setIsSubmitting(false);
                    return;
                }
                if (orderType === 'room_service' && !roomNumber) {
                    toast.error('Please enter room number');
                    setIsSubmitting(false);
                    return;
                }

                const orderData = {
                    order_type: orderType,
                    table_number: orderType === 'dine_in' ? tableNumber : undefined,
                    room_number: orderType === 'room_service' ? roomNumber : undefined,
                    customer_name: customerName || undefined,
                    payment_method: paymentMethod,
                    waiter_id: user?.id,
                    waiter_name: `${user?.firstName} ${user?.lastName}`,
                    branch_id: currentBranchId,
                    items: cart.map(item => ({
                        menu_item_id: item.id,
                        name: item.name,
                        quantity: item.quantity,
                        unit_price: item.price,
                        total_amount: item.price * item.quantity,
                        notes: item.notes,
                    })),
                    subtotal,
                    tax,
                    total,
                    status: 'pending',
                };

                const res = await restaurantAPI.createOrder(orderData);
                if (res.success) {
                    toast.success(`Restaurant order created!`);
                    try {
                        // Instant Printing
                        await handlePrintReceipt({
                            ...res.data,
                            items: cart,
                            total: total
                        });
                    } catch (e) {
                        console.error('Initial receipt failed', e);
                    }
                } else {
                    throw new Error(res.message);
                }
            } else {
                if (selectedTabId) {
                    const res = await barAPI.addToTab(selectedTabId, cart.map(item => ({
                        drink_id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity
                    })));
                    if (res.success) {
                        toast.success('Added to tab!');
                    } else {
                        throw new Error(res.message);
                    }
                } else {
                    const res = await barAPI.createOrder({
                        branch_id: currentBranchId,
                        order_type: 'bar',
                        seat_number: tableNumber || undefined,
                        items: cart.map(item => ({
                            drink_id: item.id,
                            name: item.name,
                            price: item.price,
                            quantity: item.quantity
                        })),
                        payment_method: paymentMethod,
                        status: 'pending'
                    });
                    if (res.success) {
                        toast.success('Bar order completed!');
                        try {
                            // Instant Printing
                            await handlePrintReceipt({
                                ...res.data,
                                items: cart,
                                total: total
                            });
                        } catch (e) {
                            console.error('Initial receipt failed', e);
                        }
                    } else {
                        throw new Error(res.message);
                    }
                }
            }

            clearCart();
            onOrderCreated?.();
            fetchData(); // Refresh history
        } catch (error: any) {
            toast.error(error.message || 'Failed to process order');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-full bg-stone-50 flex flex-col w-full text-stone-900 overflow-hidden">
            {/* Header Removed to maximize vertical space as per user request */}

            {/* Main Content Area - Full Bleed */}
            <div className="flex-1 flex flex-row w-full overflow-hidden min-h-0 bg-stone-100/50">
                {/* Left Side - Product Explorer */}
                <div className="flex-1 flex flex-col min-w-0 p-3 md:p-4">
                    {/* Integrated Search & View Toggle in Column */}
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder={`Search ${mode} menu...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold placeholder:text-stone-400 text-stone-900 shadow-sm"
                            />
                        </div>
                        <button
                            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                            className="p-2.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 transition-all text-stone-500 hover:text-stone-900 shadow-sm"
                        >
                            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
                        </button>
                    </div>
                    {/* Horizontal Categories Tabs - Matching Snippet Style */}
                    <div className="bg-white rounded-lg shadow-sm p-3 mb-4 overflow-x-auto no-scrollbar border border-stone-100">
                        <div className="flex gap-2 min-w-max">
                            <button
                                onClick={() => setSelectedCategoryId('all')}
                                className={cn(
                                    "px-6 py-2.5 rounded-lg font-bold transition-all text-sm whitespace-nowrap",
                                    selectedCategoryId === 'all'
                                        ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                        : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                                )}
                            >
                                All Items
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={cn(
                                        "px-6 py-2.5 rounded-lg font-bold transition-all text-sm whitespace-nowrap",
                                        selectedCategoryId === cat.id
                                            ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                                            : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dynamic Products Grid/List - Matching Snippet Style */}
                    <div className="flex-1 bg-white rounded-lg shadow-sm p-3 md:p-4 overflow-y-auto no-scrollbar border border-stone-100">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-4">
                                <RefreshCw className="h-8 w-8 animate-spin text-stone-200" />
                                <p className="text-stone-400 text-xs font-black uppercase tracking-widest">Fetching Menu</p>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-4">
                                <Search className="h-12 w-12 text-stone-100" />
                                <p className="text-stone-400 text-sm font-bold">No items found</p>
                            </div>
                        ) : (
                            <div className={cn(
                                "grid gap-3 md:gap-4",
                                viewMode === 'grid'
                                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6"
                                    : "grid-cols-1"
                            )}>
                                {filteredItems.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className={cn(
                                            "group cursor-pointer bg-white border border-stone-200 rounded-xl hover:shadow-lg transition-all duration-200 hover:-translate-y-1 relative overflow-hidden",
                                            viewMode === 'grid' ? "p-3 md:p-4 flex flex-col" : "p-3 flex flex-row items-center gap-3"
                                        )}
                                    >
                                        <div className={cn(
                                            "rounded-lg transition-all overflow-hidden bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center shrink-0",
                                            viewMode === 'grid' ? "aspect-square w-full mb-3" : "w-14 h-14"
                                        )}>
                                            {item.image_url ? (
                                                <Image src={item.image_url} alt={item.name} width={200} height={200} className="w-full h-full object-cover transition-transform group-hover:scale-110" style={{ height: 'auto' }} />
                                            ) : (
                                                <div className={cn("h-full w-full flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-500 opacity-60", accentText)}>
                                                    {isRestaurant ? <UtensilsCrossed className="w-8 h-8 opacity-20" /> : <WineIcon className="w-8 h-8 opacity-20" />}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-black tracking-widest text-stone-400 uppercase mb-1">
                                                {item.category?.name || 'Item'}
                                            </div>
                                            <h3 className="font-bold text-stone-800 text-sm truncate group-hover:text-stone-900 transition-colors">
                                                {item.name}
                                            </h3>
                                            <div className="flex items-center justify-between mt-3">
                                                <span className="text-base font-black text-stone-900">KES {item.price.toLocaleString()}</span>
                                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 text-white", accentBg)}>
                                                    <Plus className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        {!item.is_available && (
                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-3xl flex items-center justify-center z-10">
                                                <div className="bg-white border border-stone-200 px-3 py-1 rounded-full text-[10px] font-black text-stone-400">OUT OF STOCK</div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side - Cart Section - Matching Snippet Style */}
                <div className="w-64 sm:w-72 md:w-80 flex-shrink-0 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden border border-stone-200 h-full">
                    {/* Repositioned User Profile Icon in Cart Column */}
                    <div className="p-3 md:p-3.5 border-b border-stone-200 flex items-center justify-between bg-stone-50/50 relative z-20">
                        <div className="flex items-center gap-2">
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-md", accentBg)}>
                                {mode === 'restaurant' ? 'R' : 'B'}
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-black text-stone-900 uppercase tracking-tight leading-none">{user?.firstName}</p>
                                <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest leading-none mt-0.5">{user?.role.split('_')[0]}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={async () => {
                                    setShowHistory(true);
                                    // Trigger orders sync when opening history
                                    if (typeof window !== 'undefined' && (window as any).electronAPI) {
                                        try {
                                            // console.log('[POS] Triggering orders sync...');
                                            await (window as any).electronAPI.invoke('autosync:syncOrdersNow', currentBranchId, 1);
                                            // console.log('[POS] Orders sync complete');
                                            // Refresh orders after sync
                                            fetchData();
                                        } catch (e) {
                                            // console.warn('[POS] Orders sync failed:', e);
                                        }
                                    }
                                }}
                                className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-100 transition-all text-stone-400 hover:text-blue-600"
                                title="Order History"
                            >
                                <History className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-100 transition-all text-stone-400 hover:text-stone-900"
                            >
                                <UserIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => logout('/terminal')}
                                className="p-1.5 rounded-lg hover:bg-red-50 hover:shadow-sm border border-transparent hover:border-red-100 transition-all text-stone-400 hover:text-red-500"
                                title="Log Out"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <AnimatePresence>
                            {userMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                    className="absolute right-2 top-full mt-2 w-48 bg-white rounded-xl border border-stone-200 shadow-xl p-3 z-[100]"
                                >
                                    <div className="p-2 bg-stone-50 rounded-lg mb-2">
                                        <p className="text-xs font-black text-stone-900 truncate">{user?.firstName} {user?.lastName}</p>
                                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest truncate">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            setShowHistory(true);
                                            setUserMenuOpen(false);
                                            // Trigger orders sync when opening history
                                            if (typeof window !== 'undefined' && (window as any).electronAPI) {
                                                try {
                                                    // console.log('[POS] Triggering orders sync...');
                                                    await (window as any).electronAPI.invoke('autosync:syncOrdersNow', currentBranchId, 1);
                                                    // console.log('[POS] Orders sync complete');
                                                    // Refresh orders after sync
                                                    fetchData();
                                                } catch (e) {
                                                    // console.warn('[POS] Orders sync failed:', e);
                                                }
                                            }
                                        }}
                                        className="flex items-center gap-2 w-full p-2 text-xs font-bold text-stone-600 hover:bg-stone-50 rounded-lg transition-all"
                                    >
                                        <History className="w-3.5 h-3.5" />
                                        <span>Order History</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Cart Header - Fixed Size */}
                    <div className="p-3 md:p-4 border-b border-stone-200 flex items-center justify-between bg-white flex-none">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 md:w-5 h-4 md:h-5 text-blue-600" />
                            <h2 className="text-lg md:text-xl font-bold text-gray-800">Cart</h2>
                            <span className="bg-blue-600 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </span>
                        </div>
                        {cart.length > 0 && (
                            <button
                                onClick={clearCart}
                                className="text-red-600 hover:text-red-700 text-xs md:text-sm font-medium flex items-center gap-1 transition-colors"
                            >
                                <Trash2 className="w-3 md:w-4 h-3 md:h-4" />
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="px-3 md:px-4 py-3 border-b border-stone-100 bg-stone-50/30 flex-none">
                        {/* System Context Selectors - Matching Snippet Style */}
                        <div className="space-y-3">
                            {isRestaurant ? (
                                <div className="space-y-2.5">
                                    <div className="grid grid-cols-3 gap-2 bg-stone-100/50 p-1 rounded-lg border border-stone-200/50">
                                        {(['dine_in', 'takeaway', 'room_service'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setOrderType(type)}
                                                className={cn(
                                                    "py-1.5 text-[10px] md:text-xs font-medium rounded-md transition-all",
                                                    orderType === type
                                                        ? "bg-blue-600 text-white shadow-md shadow-blue-200/50"
                                                        : "text-stone-600 hover:bg-white hover:text-stone-900"
                                                )}
                                            >
                                                {type === 'dine_in' ? 'Dine In' : type === 'takeaway' ? 'Takeaway' : 'Room'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        {(orderType === 'dine_in') && (
                                            <div className="relative flex-1">
                                                <input
                                                    placeholder="T#"
                                                    value={tableNumber}
                                                    onChange={e => setTableNumber(e.target.value)}
                                                    className="w-full bg-white border border-stone-200 text-stone-900 rounded-lg h-9 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold placeholder:text-stone-400 transition-all font-mono"
                                                />
                                            </div>
                                        )}
                                        {orderType === 'room_service' && (
                                            <div className="relative flex-1">
                                                <input
                                                    placeholder="ROOM"
                                                    value={roomNumber}
                                                    onChange={e => setRoomNumber(e.target.value)}
                                                    className="w-full bg-white border border-stone-200 text-stone-900 rounded-lg h-9 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold placeholder:text-stone-400 transition-all font-mono"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-[1.5] bg-stone-100/80 border border-stone-200 rounded-lg h-9 px-3 flex items-center justify-center text-[10px] font-bold text-stone-600 truncate">
                                            <UserIcon className="h-3 w-3 mr-2 opacity-40" />
                                            {user?.firstName?.toUpperCase()}
                                        </div>
                                    </div>
                                    {orderType === 'takeaway' && (
                                        <input
                                            placeholder="CUSTOMER NAME"
                                            value={customerName}
                                            onChange={e => setCustomerName(e.target.value)}
                                            className="w-full bg-white border border-stone-200 text-stone-900 rounded-lg h-9 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold placeholder:text-stone-400"
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <select
                                            value={selectedTabId}
                                            onChange={e => setSelectedTabId(e.target.value)}
                                            className="w-full h-10 px-4 bg-white border border-stone-200 text-stone-900 rounded-lg text-[11px] font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 tracking-wider"
                                        >
                                            <option value="">WALK-IN ORDER</option>
                                            {openTabs.map(t => <option key={t.id} value={t.id}>TAB #{t.tab_number} - {t.customer_name?.toUpperCase()}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
                                    </div>
                                    {!selectedTabId && (
                                        <input
                                            placeholder="SEAT / TABLE #"
                                            value={tableNumber}
                                            onChange={e => setTableNumber(e.target.value)}
                                            className="w-full bg-white border border-stone-200 text-stone-900 rounded-lg h-10 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold placeholder:text-stone-400"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Items Area - Bulletproof containment */}
                    <div className="flex-1 relative min-h-0">
                        <div className="absolute inset-0 overflow-y-auto no-scrollbar p-3 md:p-4 space-y-3">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-stone-300">
                                    <ShoppingCart className="w-12 md:w-16 h-12 md:h-16 mb-3 opacity-30" />
                                    <p className="text-xs md:text-sm font-medium uppercase tracking-wider text-stone-400">Your cart is empty</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="relative group bg-stone-50/50 hover:bg-white border border-stone-200 rounded-lg p-2 md:p-3 transition-all duration-300">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h4 className="font-semibold text-stone-800 text-sm md:text-base truncate">{item.name}</h4>
                                                <p className="text-[10px] md:text-sm text-stone-500">KES {item.price.toLocaleString()} each</p>
                                            </div>
                                            <button onClick={() => removeFromCart(item.id)} className="text-stone-300 hover:text-red-500 transition-colors p-1">
                                                <X className="w-3 md:w-4 h-3 md:h-4" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5 shadow-sm">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="p-1 md:p-1.5 hover:bg-stone-100 text-stone-500 rounded-lg transition-colors">
                                                    <Minus className="w-2.5 md:w-3 h-2.5 md:h-3" />
                                                </button>
                                                <span className="w-6 md:w-8 text-center text-xs md:text-sm font-bold">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="p-1 md:p-1.5 hover:bg-stone-100 text-stone-500 rounded-lg transition-colors">
                                                    <Plus className="w-2.5 md:w-3 h-2.5 md:h-3" />
                                                </button>
                                            </div>
                                            <span className="text-sm md:text-base font-bold text-blue-600">KES {(item.price * item.quantity).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Cart Footer / Summary - Fixed Bottom */}
                    {cart.length > 0 && (
                        <div className="p-3 md:p-4 bg-white border-t border-stone-200 space-y-3 flex-none">
                            <div className="space-y-1.5 text-xs md:text-sm">
                                <div className="flex justify-between text-stone-500">
                                    <span>Subtotal</span>
                                    <span className="font-bold text-stone-700">KES {subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-stone-500">
                                    <span>Tax (16% Included)</span>
                                    <span className="font-bold text-stone-700">KES {tax.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 mt-2 border-t border-stone-100 text-lg md:text-xl font-black text-stone-900">
                                    <span>Total</span>
                                    <span className="text-blue-600">KES {total.toLocaleString()}</span>
                                </div>
                            </div>

                            <button
                                onClick={handleCreateOrder}
                                disabled={isSubmitting}
                                className={cn(
                                    "w-full py-3 md:py-4 rounded-lg text-white font-bold transition-all shadow-lg text-sm md:text-base flex items-center justify-center gap-3",
                                    isSubmitting ? "bg-stone-400 cursor-not-allowed scale-95" : "bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-200/50"
                                )}
                            >
                                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin text-white/50" /> : 'Place Order'}
                                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {/* History Modal */}
            <AnimatePresence>
                {showHistory && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                                <div>
                                    <h2 className="text-xl font-bold text-stone-900">My Orders</h2>
                                    <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">
                                        {user?.firstName} {user?.lastName} | {user?.role}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Date Selector */}
                                    <input
                                        type="date"
                                        value={historyDate.toISOString().split('T')[0]}
                                        onChange={(e) => setHistoryDate(new Date(e.target.value))}
                                        className="bg-white border border-stone-300 text-stone-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                                    />
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className="p-2 rounded-full hover:bg-stone-200 text-stone-500 transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Filter Controls */}
                            <div className="p-4 border-b border-stone-200 bg-white">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Status Filter */}
                                    <div>
                                        <label className="text-xs text-stone-500 mb-2 block font-medium">Order Status</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: 'all', label: 'All' },
                                                { value: 'pending', label: 'Pending' },
                                                { value: 'completed', label: 'Verified' },
                                                { value: 'cancelled', label: 'Void' },
                                            ].map((status) => {
                                                const count = recentOrders.filter(o => {
                                                    const orderDate = new Date(o.created_at);
                                                    const isSameDate = orderDate.toDateString() === historyDate.toDateString();
                                                    if (!isSameDate) return false;

                                                    if (status.value === 'all') return true;
                                                    if (status.value === 'pending') return o.status === 'pending' || o.status === 'kitchen_ready';
                                                    if (status.value === 'completed') return o.status === 'completed' || o.status === 'paid' || o.status === 'delivered' || o.status === 'served' || o.status === 'ready';
                                                    if (status.value === 'cancelled') return o.status === 'cancelled' || o.status === 'voided';
                                                    return false;
                                                }).length;

                                                return (
                                                    <button
                                                        key={status.value}
                                                        onClick={() => setHistoryStatus(status.value)}
                                                        className={cn(
                                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                                                            historyStatus === status.value
                                                                ? "bg-stone-900 text-white"
                                                                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                                                        )}
                                                    >
                                                        {status.label} ({count})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Waiter Filter */}
                                    <div>
                                        <label className="text-xs text-stone-500 mb-2 block font-medium">View Orders</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: 'my-orders', label: 'My Orders' },
                                                { value: 'all-orders', label: 'All Orders' },
                                            ].map((filter) => (
                                                <button
                                                    key={filter.value}
                                                    onClick={() => setWaiterFilter(filter.value)}
                                                    className={cn(
                                                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                                                        waiterFilter === filter.value
                                                            ? "bg-stone-900 text-white"
                                                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                                                    )}
                                                >
                                                    {filter.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Order List */}
                            <div className="flex-1 overflow-y-auto p-4 bg-stone-50 space-y-3">
                                {filteredOrders.length === 0 ? (
                                    <div className="h-64 flex flex-col items-center justify-center text-stone-400">
                                        <History className="w-12 h-12 mb-3 opacity-20" />
                                        <p className="font-medium">No orders found matching your filters.</p>
                                        <p className="text-xs mt-1">Try changing the status or waiter filter.</p>
                                    </div>
                                ) : (
                                    filteredOrders.map(order => {
                                        const isExpanded = expandedOrders.has(order.id);
                                        const itemCount = order.items?.length || 0;

                                        return (
                                            <div key={order.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                {/* Order Header - Always Visible */}
                                                <div
                                                    onClick={() => toggleOrderExpansion(order.id)}
                                                    className="p-4 cursor-pointer hover:bg-stone-50 transition-colors"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-lg text-stone-900">
                                                                    #{order.order_number || order.id.slice(0, 8).toUpperCase()}
                                                                </span>
                                                                <span className={cn(
                                                                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                                                                    order.status === 'completed' ? "bg-green-100 text-green-700" :
                                                                        order.status === 'cancelled' ? "bg-red-100 text-red-700" :
                                                                            "bg-amber-100 text-amber-700"
                                                                )}>
                                                                    {order.status}
                                                                </span>
                                                                <span className="text-xs text-stone-400 font-medium">
                                                                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-stone-500">
                                                                {new Date(order.created_at).toLocaleTimeString()} • {order.table_number ? `Table ${order.table_number}` : order.room_number ? `Room ${order.room_number}` : 'Walk-in'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-start gap-3">
                                                            <div className="text-right">
                                                                <p className="font-black text-lg text-stone-900">KES {order.total_amount?.toLocaleString() || order.total?.toLocaleString()}</p>
                                                                <p className="text-xs text-stone-400 uppercase font-bold">{order.payment_method}</p>
                                                            </div>
                                                            <ChevronDown className={cn(
                                                                "w-5 h-5 text-stone-400 transition-transform duration-200 mt-1",
                                                                isExpanded && "rotate-180"
                                                            )} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expandable Items Section */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="px-4 pb-4 border-t border-stone-100">
                                                                {/* Items List */}
                                                                <div className="bg-stone-50 rounded-lg p-3 mt-3 mb-3 text-xs text-stone-600 space-y-2">
                                                                    <p className="font-bold text-stone-700 uppercase text-[10px] tracking-wider mb-2">Order Items</p>
                                                                    {order.items?.map((item: any, idx: number) => (
                                                                        <div key={idx} className="flex justify-between items-center py-1">
                                                                            <span className="font-medium">{item.quantity}x {item.name || item.menu_item?.name}</span>
                                                                            <span className="font-bold">KES {((item.unit_price || item.price) * item.quantity).toLocaleString()}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Actions */}
                                                                {historyStatus === 'pending' && (
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handlePrintReceipt(order);
                                                                            }}
                                                                            className="col-span-2 py-2.5 text-xs font-bold text-white bg-stone-800 hover:bg-stone-950 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                                                                        >
                                                                            <FileText className="w-4 h-4" />
                                                                            RECALL BILL
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleEditOrder(order);
                                                                            }}
                                                                            className="py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors uppercase"
                                                                        >
                                                                            Edit / Copy
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setIsVoiding(order.id);
                                                                                setVoidConfirmOpen(true);
                                                                            }}
                                                                            className="py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors uppercase"
                                                                        >
                                                                            Void Order
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toast.info('Merge bill feature - select multiple bills to merge');
                                                                            }}
                                                                            className="py-2 text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors uppercase"
                                                                        >
                                                                            Merge Bill
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toast.info('Split bill feature - divide bill by items or amount');
                                                                            }}
                                                                            className="py-2 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors uppercase"
                                                                        >
                                                                            Split Bill
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {historyStatus === 'voided' && order.void_reason && (
                                                                    <div className="mt-2 text-xs text-red-500 italic bg-red-50 p-2 rounded">
                                                                        Reason: {order.void_reason}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Void Confirmation Modal */}
            <AnimatePresence>
                {voidConfirmOpen && (
                    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
                        >
                            <h3 className="text-lg font-bold text-stone-900 mb-2">Confirm Void Order</h3>
                            <p className="text-sm text-stone-500 mb-4">
                                Are you sure you want to void this order? This action cannot be undone and will mark the order as cancelled.
                            </p>

                            <label className="block text-sm font-medium text-stone-700 mb-1.5">Reason for voiding</label>
                            <textarea
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                placeholder="e.g. Wrong items, Customer changed mind..."
                                className="w-full h-24 p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-red-500/20 outline-none resize-none"
                            ></textarea>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setVoidConfirmOpen(false)}
                                    className="flex-1 py-2.5 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleVoidOrder}
                                    disabled={!voidReason.trim()}
                                    className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-red-200"
                                >
                                    Confirm Void
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
