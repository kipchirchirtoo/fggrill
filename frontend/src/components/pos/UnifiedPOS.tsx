'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { restaurantAPI, barAPI, staffAPI, receiptsAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
    Search, ChefHat, Plus, Minus, X, ShoppingCart,
    UtensilsCrossed, Wine, FileText, RefreshCw,
    WineIcon, ConciergeBell, History, Layers, Check,
    AlertCircle, Info, Trash2
} from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
    const [selectedWaiterId, setSelectedWaiterId] = useState<string>('');
    const [waiters, setWaiters] = useState<Waiter[]>([]);

    // Bar specific state
    const [openTabs, setOpenTabs] = useState<any[]>([]);
    const [selectedTabId, setSelectedTabId] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (isRestaurant) {
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

                if (drinksRes.success) setItems(drinksRes.data || []);
                if (categoriesRes.success) {
                    const barKeywords = ['beverage', 'drink', 'beer', 'wine', 'cocktail', 'spirit', 'juice', 'tea', 'coffee', 'water', 'soda', 'shisha', 'liquor'];
                    const filteredCats = (categoriesRes.data || []).filter((c: any) => {
                        const name = c.name?.toLowerCase() || '';
                        return barKeywords.some(k => name.includes(k));
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
    }, [mode, currentBranchId, isRestaurant]);

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
            if (isRestaurant) {
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

                await restaurantAPI.createOrder(orderData);
                toast.success(`Restaurant order created!`);
            } else {
                if (selectedTabId) {
                    const res = await barAPI.addToTab(selectedTabId, cart.map(item => ({
                        drink_id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity
                    })));
                    if (res.success) toast.success('Added to tab!');
                    else throw new Error(res.message);
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
                        try {
                            const receiptData = {
                                receipt_type: 'sale' as const,
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
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to process order');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden p-1">
            {/* Menu Area - Premium Grid */}
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <div className="bg-white/70 backdrop-blur-md border border-stone-200/50 rounded-[2rem] flex flex-col h-full overflow-hidden shadow-xl shadow-stone-200/40">
                    {/* Search & Categories */}
                    <div className="p-6 border-b border-stone-100 flex-shrink-0 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                                <input
                                    placeholder={`Search ${isRestaurant ? 'delicious food' : 'refreshing drinks'}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 h-13 bg-stone-100/50 border-transparent focus:bg-white focus:ring-2 focus:ring-stone-200 rounded-2xl transition-all text-sm font-medium"
                                />
                            </div>
                            <div className="hidden sm:flex items-center gap-2 ml-4">
                                <span className={cn("text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full", accentLightBg, accentText)}>
                                    {mode} MODE
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            <button
                                onClick={() => setSelectedCategoryId('all')}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300",
                                    selectedCategoryId === 'all'
                                        ? cn(accentBg, "text-white shadow-lg", isRestaurant ? "shadow-amber-200" : "shadow-indigo-200")
                                        : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                                )}
                            >
                                All Items
                            </button>
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={cn(
                                        "px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap",
                                        selectedCategoryId === cat.id
                                            ? cn(accentBg, "text-white shadow-lg", isRestaurant ? "shadow-amber-200" : "shadow-indigo-200")
                                            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid of Items */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gradient-to-b from-transparent to-stone-50/30">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <div className={cn("h-12 w-12 rounded-full border-4 border-t-transparent animate-spin", isRestaurant ? "border-amber-500" : "border-indigo-600")}></div>
                                <p className="text-stone-400 font-medium animate-pulse text-sm">Loading Menu...</p>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-stone-300 py-12">
                                <div className="bg-stone-100 p-8 rounded-[2.5rem] mb-6">
                                    <Search className="h-16 w-16 opacity-20" />
                                </div>
                                <p className="text-lg font-bold text-stone-400">No items match your search</p>
                                <button onClick={() => { setSearchQuery(''); setSelectedCategoryId('all'); }} className="mt-4 text-sm font-bold text-stone-500 underline underline-offset-4">Reset Filters</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                {filteredItems.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className="group bg-white border border-stone-100 rounded-[2rem] p-4 cursor-pointer hover:shadow-2xl hover:shadow-stone-200 hover:-translate-y-1 transition-all duration-500 active:scale-95 flex flex-col items-center text-center relative overflow-hidden"
                                    >
                                        <div className="w-full aspect-square rounded-[1.5rem] mb-4 flex items-center justify-center overflow-hidden relative bg-stone-50">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    {isRestaurant ? <UtensilsCrossed className="h-12 w-12 text-stone-200" /> : <Wine className="h-12 w-12 text-stone-200" />}
                                                </div>
                                            )}
                                            <div className={cn(
                                                "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300",
                                                isRestaurant ? "bg-amber-500" : "bg-indigo-600"
                                            )}></div>

                                            {/* Add Badge Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-50 group-hover:scale-100">
                                                <div className={cn("p-3 rounded-full text-white shadow-xl", accentBg)}>
                                                    <Plus className="h-6 w-6" />
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="font-bold text-sm text-stone-800 line-clamp-2 mb-2 h-10">{item.name}</h3>
                                        <div className={cn("font-black text-base transition-colors duration-300", accentText)}>
                                            KES {item.price.toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cart Section - Sleek Glassmorphism Side Panel */}
            <div className="w-full lg:w-[26rem] flex flex-col shrink-0 gap-4 overflow-hidden">
                <div className="bg-stone-900 border border-stone-800 rounded-[2.5rem] flex flex-col h-full overflow-hidden shadow-2xl relative">
                    {/* Cart Header */}
                    <div className="p-8 border-b border-stone-800 shrink-0">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black text-white flex items-center gap-3">
                                <div className={cn("p-2 rounded-xl", accentBg)}>
                                    <ShoppingCart className="h-5 w-5" />
                                </div>
                                YOUR CART
                            </h2>
                            {cart.length > 0 && (
                                <button onClick={clearCart} className="text-[11px] font-black uppercase tracking-widest text-stone-500 hover:text-red-400 transition-colors">Clear</button>
                            )}
                        </div>

                        {/* Order Context / Inputs */}
                        <div className="space-y-4">
                            {isRestaurant ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-1 bg-stone-800/50 p-1 rounded-2xl">
                                        {(['dine_in', 'takeaway', 'room_service'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setOrderType(type)}
                                                className={cn(
                                                    "py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                                    orderType === type ? "bg-stone-700 text-white shadow-lg" : "text-stone-500 hover:text-stone-300"
                                                )}
                                            >
                                                {type === 'dine_in' ? 'Dine In' : type === 'takeaway' ? 'Takeaway' : 'Room'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {orderType === 'dine_in' && (
                                            <input placeholder="TABLE #" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="bg-stone-800/50 border-none text-white rounded-xl h-12 px-4 focus:ring-2 focus:ring-amber-500/50 text-xs font-bold placeholder:text-stone-600" />
                                        )}
                                        {orderType === 'room_service' && (
                                            <input placeholder="ROOM #" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} className="bg-stone-800/50 border-none text-white rounded-xl h-12 px-4 focus:ring-2 focus:ring-amber-500/50 text-xs font-bold placeholder:text-stone-600" />
                                        )}
                                        {(orderType === 'dine_in' || orderType === 'room_service') && (
                                            <select
                                                value={selectedWaiterId}
                                                onChange={e => setSelectedWaiterId(e.target.value)}
                                                className="bg-stone-800/50 border-none text-white rounded-xl h-12 px-4 focus:ring-2 focus:ring-amber-500/50 text-xs font-bold appearance-none cursor-pointer"
                                            >
                                                <option value="" className="bg-stone-900">SELECT WAITER</option>
                                                {waiters.map(w => <option key={w.id} value={w.id} className="bg-stone-900">{w.first_name.toUpperCase()}</option>)}
                                            </select>
                                        )}
                                        {orderType === 'takeaway' && (
                                            <input placeholder="CUSTOMER NAME" value={customerName} onChange={e => setCustomerName(e.target.value)} className="bg-stone-800/50 border-none text-white rounded-xl h-12 px-4 focus:ring-2 focus:ring-amber-500/50 text-xs font-bold col-span-2 placeholder:text-stone-600" />
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <select
                                            value={selectedTabId}
                                            onChange={e => setSelectedTabId(e.target.value)}
                                            className="w-full h-13 px-4 bg-stone-800/50 border-none text-white rounded-2xl text-[13px] font-bold appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/50"
                                        >
                                            <option value="" className="bg-stone-900">--- WALK-IN ORDER ---</option>
                                            {openTabs.map(t => <option key={t.id} value={t.id} className="bg-stone-900">T#{t.tab_number.padStart(3, '0')} - {t.customer_name.toUpperCase()}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-500">
                                            <ChevronDown className="h-4 w-4" />
                                        </div>
                                    </div>
                                    {!selectedTabId && (
                                        <input placeholder="SEAT / TABLE REFERENCE" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full bg-stone-800/50 border-none text-white rounded-2xl h-13 px-4 focus:ring-2 focus:ring-indigo-500/50 text-xs font-bold placeholder:text-stone-600" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Items List */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-4">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-stone-700 py-12">
                                <div className="bg-stone-800/30 p-10 rounded-[3rem] mb-6">
                                    <ShoppingCart className="h-16 w-16 opacity-10" />
                                </div>
                                <p className="text-lg font-black tracking-widest opacity-20">EMPTY CART</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {cart.map((item) => (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "flex items-center gap-4 p-4 rounded-[1.5rem] border border-stone-800/50 transition-all duration-300",
                                            lastAddedId === item.id ? "bg-stone-800/80 scale-[1.02] border-stone-700" : "bg-stone-800/30"
                                        )}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-extrabold text-sm text-white truncate uppercase tracking-tight">{item.name}</p>
                                            <p className={cn("text-[13px] font-black mt-1", accentText)}>KES {(item.price * item.quantity).toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-stone-800">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="w-9 h-9 flex items-center justify-center text-stone-500 hover:text-white hover:bg-stone-800 rounded-lg transition-colors">
                                                <Minus className="h-3 w-3" />
                                            </button>
                                            <span className="w-8 text-center text-xs font-black text-white">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="w-9 h-9 flex items-center justify-center text-stone-500 hover:text-white hover:bg-stone-800 rounded-lg transition-colors">
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-stone-700 hover:text-red-500 p-2 transition-colors">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer / Summary / Payment */}
                    <div className="p-8 border-t border-stone-800 bg-black/20 shrink-0 space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-stone-500">
                                <span>SUBTOTAL (NET)</span>
                                <span>KES {subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-stone-500">
                                <span>TAXES (VAT 16.0%)</span>
                                <span>KES {tax.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-end pt-4 border-t border-stone-800/50 mt-4">
                                <span className="text-xs font-black text-stone-400">TOTAL AMOUNT</span>
                                <span className="text-2xl font-black text-white tracking-tighter">KES {total.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Modern Payment Selector */}
                            <div className="grid grid-cols-3 gap-2 bg-stone-800/30 p-1.5 rounded-2xl border border-stone-800/50">
                                {(['cash', 'mpesa', 'card'] as const).map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        className={cn(
                                            "py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                            paymentMethod === method ? "bg-white text-stone-900 shadow-xl" : "text-stone-600 hover:text-stone-400"
                                        )}
                                    >
                                        {method === 'mpesa' ? 'M-Pesa' : method}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleCreateOrder}
                                disabled={cart.length === 0 || isSubmitting}
                                className={cn(
                                    "w-full h-16 rounded-[1.5rem] font-black text-[15px] uppercase tracking-[0.1em] flex items-center justify-center gap-3 transition-all active:scale-[0.97] disabled:opacity-30 disabled:grayscale disabled:active:scale-100 shadow-2xl relative overflow-hidden group/btn",
                                    accentBg, accentColor === 'amber' ? "shadow-amber-900/40" : "shadow-indigo-900/40",
                                    "text-white"
                                )}
                            >
                                {isSubmitting ? (
                                    <RefreshCw className="h-6 w-6 animate-spin" />
                                ) : (
                                    <div className="flex items-center gap-4">
                                        <div className="bg-black/10 p-2 rounded-xl group-hover/btn:scale-110 transition-transform duration-300">
                                            {isRestaurant ? <ChefHat className="h-6 w-6" /> : <ConciergeBell className="h-6 w-6" />}
                                        </div>
                                        <span>
                                            {isRestaurant ? 'SEND TO KITCHEN' : (selectedTabId ? 'ADD TO TAB' : 'COMPLETE SALE')}
                                        </span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Add missing icon
function ChevronDown(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}
