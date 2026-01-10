'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { restaurantAPI, barAPI, staffAPI, receiptsAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
    Search, ChefHat, Plus, Minus, X, ShoppingCart,
    UtensilsCrossed, Wine, FileText, RefreshCw,
    WineIcon, ConciergeBell, History
} from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';

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

interface Waiter {
    id: string;
    first_name: string;
    last_name: string;
    status: 'active' | 'inactive';
}

interface UnifiedPOSProps {
    mode: 'restaurant' | 'bar';
    onOrderCreated?: () => void;
}

export function UnifiedPOS({ mode, onOrderCreated }: UnifiedPOSProps) {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const currentBranchId = activeBranchId || user?.branch_id;

    // Menu state
    const [items, setItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Cart state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Restaurant specific state
    const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'room_service'>('dine_in');
    const [tableNumber, setTableNumber] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectedWaiterId, setSelectedWaiterId] = useState<string>('');
    const [waiters, setWaiters] = useState<Waiter[]>([]);

    // Bar specific state
    const [openTabs, setOpenTabs] = useState<any[]>([]);
    const [selectedTabId, setSelectedTabId] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (mode === 'restaurant') {
                const [itemsRes, categoriesRes, waitersRes] = await Promise.all([
                    restaurantAPI.getMenuItems(undefined, currentBranchId || undefined, true),
                    restaurantAPI.getCategories(),
                    staffAPI.getWaiters(currentBranchId || undefined)
                ]);

                if (itemsRes.success) setItems(itemsRes.data || []);
                if (categoriesRes.success) setCategories(categoriesRes.data || []);
                if (waitersRes.success) {
                    const mappedWaiters = (waitersRes.data || []).map((w: any) => ({
                        id: w.id,
                        first_name: w.user?.first_name || w.first_name || '',
                        last_name: w.user?.last_name || w.last_name || '',
                        status: w.status || 'active'
                    })).filter((w: Waiter) => w.status === 'active');
                    setWaiters(mappedWaiters);
                }
            } else {
                const [drinksRes, categoriesRes, tabsRes] = await Promise.all([
                    barAPI.getDrinks(),
                    barAPI.getCategories(),
                    barAPI.getTabs(currentBranchId || undefined, 'open')
                ]);

                if (drinksRes.success) {
                    // Note: bar items are already filtered by a wrapper usually, but here we show all drinks
                    setItems(drinksRes.data || []);
                }
                if (categoriesRes.success) {
                    // Filter out food categories for bar mode if they come from the same generic table
                    const foodKeywords = ['food', 'kitchen', 'main', 'starter', 'breakfast', 'lunch', 'dinner', 'dessert', 'platter', 'soup', 'salad', 'grill', 'burger', 'pizza', 'pasta', 'meal'];
                    const filteredCats = (categoriesRes.data || []).filter((c: any) => {
                        const name = c.name?.toLowerCase() || '';
                        return !foodKeywords.some(k => name.includes(k));
                    });
                    setCategories(filteredCats);
                }
                if (tabsRes.success) setOpenTabs(tabsRes.data || []);
            }
        } catch (error) {
            console.error(`Error fetching ${mode} data:`, error);
            toast.error(`Failed to load ${mode} menu`);
        } finally {
            setIsLoading(false);
        }
    }, [mode, currentBranchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addToCart = (item: MenuItem) => {
        setCart((prev) => {
            const existing = prev.find((i) => i.id === item.id);
            if (existing) return prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...item, quantity: 1 }];
        });
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
        setSelectedWaiterId('');
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

    const handleCreateOrder = async () => {
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        setIsSubmitting(true);
        try {
            if (mode === 'restaurant') {
                if (orderType === 'dine_in' && !tableNumber) {
                    toast.error('Please enter table number');
                    setIsSubmitting(false);
                    return;
                }
                if (orderType === 'dine_in' && !selectedWaiterId) {
                    toast.error('Please select a waiter');
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
                    waiter_id: selectedWaiterId || undefined,
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

                const response = await restaurantAPI.createOrder(orderData);
                toast.success(`Restaurant order created!`);
            } else {
                // Bar Logic
                if (selectedTabId) {
                    const res = await barAPI.addToTab(selectedTabId, cart.map(item => ({
                        drink_id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity
                    })));
                    if (res.success) {
                        toast.success('Added to tab!');
                    } else throw new Error(res.message);
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
                        status: 'completed'
                    });
                    if (res.success) {
                        toast.success('Bar order completed!');

                        // Try auto-receipt for bar
                        try {
                            const receiptData = {
                                receipt_type: 'sale',
                                receipt_number: res.data.order_number || res.data.id.substring(0, 8),
                                date: new Date().toISOString(),
                                table_number: tableNumber,
                                items: cart.map(item => ({
                                    name: item.name,
                                    quantity: item.quantity,
                                    unit_price: item.price,
                                    total: item.price * item.quantity
                                })),
                                total_amount: total,
                                payment_method: paymentMethod
                            };
                            const receiptRes = await receiptsAPI.generateReceipt(receiptData);
                            if (receiptRes.success && receiptRes.data?.pdf_base64) {
                                const pdfWindow = window.open("");
                                pdfWindow?.document.write(`<iframe width='100%' height='100%' src='data:application/pdf;base64,${receiptRes.data.pdf_base64}'></iframe>`);
                            }
                        } catch (e) { console.error('Receipt skipped', e); }
                    } else throw new Error(res.message);
                }
            }

            clearCart();
            onOrderCreated?.();
            fetchData(); // Refresh state
        } catch (error: any) {
            toast.error(error.message || 'Failed to process order');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full overflow-hidden">
            {/* Menu Area */}
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <div className="bg-white border rounded-lg flex flex-col h-full overflow-hidden">
                    {/* Search & Categories */}
                    <div className="p-4 border-b space-y-3 shrink-0">
                        <div className="flex items-center justify-between lg:hidden mb-1">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                {mode === 'restaurant' ? <UtensilsCrossed className="h-5 w-5" /> : <Wine className="h-5 w-5" />}
                                {mode === 'restaurant' ? 'Food' : 'Drinks'}
                            </h2>
                            <IOSButton size="sm" variant="secondary" onClick={() => document.getElementById('cart-section')?.scrollIntoView({ behavior: 'smooth' })}>
                                <ShoppingCart className="h-4 w-4" />
                                {cart.length > 0 && <span className="ml-1 text-xs font-bold">{cart.length}</span>}
                            </IOSButton>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder={`Search ${mode === 'restaurant' ? 'menu items' : 'drinks'}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-11 bg-stone-50 border-stone-200"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            <button
                                onClick={() => setSelectedCategoryId('all')}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategoryId === 'all' ? 'bg-amber-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                            >
                                All
                            </button>
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategoryId === cat.id ? 'bg-amber-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <RefreshCw className="h-8 w-8 animate-spin text-stone-300" />
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-stone-400">
                                <Search className="h-12 w-12 mb-2 opacity-20" />
                                <p>No items found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                {filteredItems.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className="group bg-white border border-stone-200 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-amber-200 transition-all active:scale-95 flex flex-col h-full"
                                    >
                                        <div className="aspect-square bg-stone-50 rounded-lg mb-2.5 flex items-center justify-center overflow-hidden relative">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            ) : (
                                                <div className="bg-stone-50 w-full h-full flex items-center justify-center">
                                                    {mode === 'restaurant' ? <UtensilsCrossed className="h-8 w-8 text-stone-200" /> : <Wine className="h-8 w-8 text-stone-200" />}
                                                </div>
                                            )}
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="bg-amber-500 text-white p-1 rounded-full shadow-lg">
                                                    <Plus className="h-3 w-3" />
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="font-semibold text-[13px] leading-tight text-stone-800 line-clamp-2 mb-1 flex-1">{item.name}</h3>
                                        <p className="text-amber-600 font-bold text-sm">KES {item.price.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cart & Checkout */}
            <div id="cart-section" className="w-full lg:w-96 flex flex-col shrink-0 gap-4">
                <div className="bg-white border rounded-lg flex flex-col h-full overflow-hidden">
                    {/* Cart Header */}
                    <div className="p-4 border-b bg-stone-50/50">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-stone-800 flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5" />
                                Cart
                            </h2>
                            {cart.length > 0 && (
                                <button onClick={clearCart} className="text-xs text-red-500 hover:underline">Clear</button>
                            )}
                        </div>

                        {/* Mode Specific Inputs */}
                        <div className="space-y-3">
                            {mode === 'restaurant' ? (
                                <>
                                    <div className="grid grid-cols-3 gap-1">
                                        {(['dine_in', 'takeaway', 'room_service'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setOrderType(type)}
                                                className={`py-1.5 text-[10px] uppercase tracking-wider font-bold rounded-md transition-all ${orderType === type ? 'bg-stone-800 text-white shadow-sm' : 'bg-stone-200/50 text-stone-500 hover:bg-stone-200'}`}
                                            >
                                                {type === 'dine_in' ? 'Dine In' : type === 'takeaway' ? 'Take' : 'Room'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {orderType === 'dine_in' && (
                                            <Input placeholder="Table #" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="h-9 text-xs" />
                                        )}
                                        {orderType === 'room_service' && (
                                            <Input placeholder="Room #" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} className="h-9 text-xs" />
                                        )}
                                        {(orderType === 'dine_in' || orderType === 'room_service') && (
                                            <select
                                                value={selectedWaiterId}
                                                onChange={e => setSelectedWaiterId(e.target.value)}
                                                className="h-9 px-2 text-xs border rounded-lg bg-white"
                                            >
                                                <option value="">Waiter</option>
                                                {waiters.map(w => <option key={w.id} value={w.id}>{w.first_name}</option>)}
                                            </select>
                                        )}
                                        {orderType === 'takeaway' && (
                                            <Input placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-9 text-xs col-span-2" />
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2">
                                    <select
                                        value={selectedTabId}
                                        onChange={e => setSelectedTabId(e.target.value)}
                                        className="w-full h-10 px-3 text-xs border rounded-lg bg-white"
                                    >
                                        <option value="">Walk-in Order</option>
                                        {openTabs.map(t => <option key={t.id} value={t.id}>Tab #{t.tab_number} - {t.customer_name}</option>)}
                                    </select>
                                    {!selectedTabId && (
                                        <Input placeholder="Seat/Table Reference" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="h-10 text-xs" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-stone-300">
                                <ShoppingCart className="h-12 w-12 mb-2 opacity-10" />
                                <p className="text-sm">Empty Cart</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cart.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3 p-2.5 bg-stone-50 rounded-xl border border-stone-100">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-[13px] text-stone-800 truncate">{item.name}</p>
                                            <p className="text-amber-600 text-[12px] font-medium">KES {(item.price * item.quantity).toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg p-0.5">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-600">
                                                <Minus className="h-3 w-3" />
                                            </button>
                                            <span className="w-5 text-center text-[12px] font-bold text-stone-700">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-600">
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer & Actions */}
                    <div className="p-4 border-t bg-stone-50/50 space-y-4">
                        <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-[13px] text-stone-500">
                                <span>Subtotal (Net)</span>
                                <span>KES {subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[13px] text-stone-500">
                                <span>VAT (16%)</span>
                                <span>KES {tax.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-lg font-black text-stone-900 pt-2 border-t border-stone-200">
                                <span>TOTAL</span>
                                <span>KES {total.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* Payment Method Selector */}
                            <div className="grid grid-cols-3 gap-2 p-1 bg-stone-200/50 rounded-lg">
                                {(['cash', 'mpesa', 'card'] as const).map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        className={`py-1.5 text-[10px] font-bold rounded-md transition-all ${paymentMethod === method ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:bg-stone-200/80'}`}
                                    >
                                        {method === 'mpesa' ? 'M-Pesa' : method.toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleCreateOrder}
                                disabled={cart.length === 0 || isSubmitting}
                                className={`w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-lg ${mode === 'restaurant' ? 'bg-amber-500 text-white shadow-amber-100' : 'bg-stone-800 text-white shadow-stone-200'}`}
                            >
                                {isSubmitting ? <RefreshCw className="h-5 w-5 animate-spin" /> : (
                                    <>
                                        {mode === 'restaurant' ? <ChefHat className="h-5 w-5" /> : <ConciergeBell className="h-5 w-5" />}
                                        <span>{mode === 'restaurant' ? 'Send to Kitchen' : (selectedTabId ? 'Add to Tab' : 'Place Order')}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
