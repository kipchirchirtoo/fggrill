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
    AlertCircle, Info, Trash2, User as UserIcon
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


interface UnifiedPOSProps {
    mode: 'restaurant' | 'bar';
    onOrderCreated?: () => void;
}

export function UnifiedPOS({ mode, onOrderCreated }: UnifiedPOSProps) {
    const { user, logout } = useAuth();
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

    // Bar specific state
    const [openTabs, setOpenTabs] = useState<any[]>([]);
    const [selectedTabId, setSelectedTabId] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (isRestaurant) {
                const [itemsRes, categoriesRes] = await Promise.all([
                    restaurantAPI.getMenuItems(undefined, currentBranchId || undefined, true),
                    restaurantAPI.getCategories()
                ]);

                if (itemsRes.success) setItems(itemsRes.data || []);
                if (categoriesRes.success) setCategories(categoriesRes.data || []);
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
                                payment_method: paymentMethod,
                                cashier_name: `${user?.firstName} ${user?.lastName}`,
                                served_by: `${user?.firstName} ${user?.lastName}`
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

            // Go back to login/PIN screen after order
            setTimeout(() => {
                logout('/login?mode=pos');
            }, 1500);
        } catch (error: any) {
            toast.error(error.message || 'Failed to process order');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center">
            <div className="container mx-auto h-full flex flex-col lg:flex-row gap-4 xl:gap-6 overflow-hidden p-1 max-w-[1700px]">
                {/* Menu Area - Elastic Grid */}
                <div className="flex-1 overflow-hidden flex flex-col min-w-0 h-full">
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
                                        "px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[11px] md:text-xs font-bold transition-all duration-300 whitespace-nowrap",
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
                                            "px-4 md:px-6 py-2 md:py-2.5 rounded-xl text-[11px] md:text-xs font-bold transition-all duration-300 whitespace-nowrap",
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
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-gradient-to-b from-transparent to-stone-50/30">
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
                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-3 md:gap-6">
                                    {filteredItems.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => addToCart(item)}
                                            className="group bg-white border border-stone-100 rounded-[1.5rem] md:rounded-[2rem] p-3 md:p-4 cursor-pointer hover:shadow-2xl hover:shadow-stone-200 hover:-translate-y-1 transition-all duration-500 active:scale-95 flex flex-col items-center text-center relative overflow-hidden"
                                        >
                                            <div className="w-full aspect-square rounded-[1.25rem] md:rounded-[1.5rem] mb-3 md:mb-4 flex items-center justify-center overflow-hidden relative bg-stone-50">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        {isRestaurant ? <UtensilsCrossed className="h-8 w-8 md:h-12 md:w-12 text-stone-200" /> : <Wine className="h-8 w-8 md:h-12 md:w-12 text-stone-200" />}
                                                    </div>
                                                )}
                                                <div className={cn(
                                                    "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300",
                                                    isRestaurant ? "bg-amber-500" : "bg-indigo-600"
                                                )}></div>

                                                {/* Add Badge Overlay */}
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-50 group-hover:scale-100">
                                                    <div className={cn("p-2 md:p-3 rounded-full text-white shadow-xl", accentBg)}>
                                                        <Plus className="h-4 w-4 md:h-6 md:w-6" />
                                                    </div>
                                                </div>
                                            </div>
                                            <h3 className="font-bold text-[11px] md:text-sm text-stone-800 line-clamp-2 mb-1.5 md:mb-2 md:h-10 leading-tight">{item.name}</h3>
                                            <div className={cn("font-black text-xs md:text-base transition-colors duration-300", accentText)}>
                                                KES {item.price.toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cart Section - Elastic Side Panel */}
                <div className="w-full sm:w-[20rem] md:w-[22rem] lg:w-[24rem] xl:w-[28rem] flex flex-col shrink-0 gap-4 overflow-hidden h-full">
                    <div className="bg-white border border-stone-200 rounded-[2.5rem] flex flex-col h-full overflow-hidden shadow-xl shadow-stone-200/50 relative">
                        {/* Cart Header */}
                        <div className="p-4 md:p-5 border-b border-stone-100 shrink-0">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-md md:text-lg font-black text-stone-900 flex items-center gap-2 md:gap-2.5">
                                    <div className={cn("p-1.5 rounded-lg text-white", accentBg)}>
                                        <ShoppingCart className="h-4 w-4" />
                                    </div>
                                    YOUR CART
                                </h2>
                                {cart.length > 0 && (
                                    <button onClick={clearCart} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-red-500 transition-colors bg-stone-50 px-2 py-1 rounded-md border border-stone-200">Empty Cart</button>
                                )}
                            </div>

                            {/* Order Context / Inputs */}
                            <div className="space-y-2.5">
                                {isRestaurant ? (
                                    <div className="space-y-2.5">
                                        <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl">
                                            {(['dine_in', 'takeaway', 'room_service'] as const).map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setOrderType(type)}
                                                    className={cn(
                                                        "py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                                        orderType === type ? "bg-white text-stone-900 shadow-sm border border-stone-100" : "text-stone-500 hover:text-stone-700"
                                                    )}
                                                >
                                                    {type === 'dine_in' ? 'Dine In' : type === 'takeaway' ? 'Takeaway' : 'Room'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {orderType === 'dine_in' && (
                                                <input placeholder="TABLE #" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="bg-stone-50 border border-stone-200 text-stone-900 rounded-xl h-10 px-3 focus:ring-2 focus:ring-amber-500/20 text-xs font-bold placeholder:text-stone-400 focus:bg-white transition-all w-full" />
                                            )}
                                            {orderType === 'room_service' && (
                                                <input placeholder="ROOM #" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} className="bg-stone-50 border border-stone-200 text-stone-900 rounded-xl h-10 px-3 focus:ring-2 focus:ring-amber-500/20 text-xs font-bold placeholder:text-stone-400 focus:bg-white transition-all w-full" />
                                            )}
                                            {(orderType === 'dine_in' || orderType === 'room_service') && (
                                                <div className="bg-stone-50 border border-stone-200 text-stone-900 rounded-xl h-10 px-3 flex items-center text-[10px] font-black appearance-none w-full truncate">
                                                    <UserIcon className="h-3 w-3 mr-2 opacity-40" />
                                                    {user?.firstName?.toUpperCase()} {user?.lastName?.toUpperCase()}
                                                </div>
                                            )}
                                            {orderType === 'takeaway' && (
                                                <input placeholder="CUSTOMER NAME" value={customerName} onChange={e => setCustomerName(e.target.value)} className="bg-stone-50 border border-stone-200 text-stone-900 rounded-xl h-10 px-3 focus:ring-2 focus:ring-amber-500/20 text-xs font-bold col-span-2 placeholder:text-stone-400 focus:bg-white transition-all w-full" />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        <div className="relative">
                                            <select
                                                value={selectedTabId}
                                                onChange={e => setSelectedTabId(e.target.value)}
                                                className="w-full h-11 px-4 bg-stone-50 border border-stone-200 text-stone-900 rounded-xl text-[12px] font-bold appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                                            >
                                                <option value="" className="bg-white">--- WALK-IN ORDER ---</option>
                                                {openTabs.map(t => <option key={t.id} value={t.id} className="bg-white">T#{t.tab_number.padStart(3, '0')} - {t.customer_name.toUpperCase()}</option>)}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                                                <ChevronDown className="h-4 w-4" />
                                            </div>
                                        </div>
                                        {!selectedTabId && (
                                            <input placeholder="SEAT / TABLE REFERENCE" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full bg-stone-50 border border-stone-200 text-stone-900 rounded-xl h-11 px-4 focus:ring-2 focus:ring-indigo-500/20 text-xs font-bold placeholder:text-stone-400 focus:bg-white transition-all" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Cart Items List */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar space-y-2.5 min-h-0">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-stone-300 py-6">
                                    <div className="bg-stone-50 p-6 md:p-8 rounded-[2rem] mb-4">
                                        <ShoppingCart className="h-8 w-8 md:h-10 md:w-10 opacity-20" />
                                    </div>
                                    <p className="text-[10px] md:text-xs font-black tracking-[0.2em] opacity-30">EMPTY CART</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {cart.map((item) => (
                                        <div
                                            key={item.id}
                                            className={cn(
                                                "flex items-center gap-3 p-2 md:p-2.5 rounded-xl border border-stone-100 transition-all duration-300",
                                                lastAddedId === item.id ? "bg-stone-100 scale-[1.01] border-stone-200" : "bg-white shadow-sm"
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-[12px] md:text-[13px] text-stone-900 truncate uppercase tracking-tight">{item.name}</p>
                                                <p className={cn("text-[10px] md:text-[11px] font-black mt-0.5", accentText)}>KES {(item.price * item.quantity).toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center gap-0.5 bg-stone-50 rounded-lg p-0.5 border border-stone-100">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-white rounded-md transition-colors">
                                                    <Minus className="h-2 w-2 md:h-2.5 md:w-2.5" />
                                                </button>
                                                <span className="w-5 md:w-6 text-center text-[10px] md:text-[11px] font-black text-stone-900">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-white rounded-md transition-colors">
                                                    <Plus className="h-2 w-2 md:h-2.5 md:w-2.5" />
                                                </button>
                                            </div>
                                            <button onClick={() => removeFromCart(item.id)} className="text-stone-400 hover:text-red-500 p-1 md:p-1.5 transition-colors">
                                                <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer / Summary / Payment */}
                        <div className="p-5 border-t border-stone-100 bg-stone-50/50 shrink-0 space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-stone-500">
                                    <span className="opacity-70">SUBTOTAL (NET)</span>
                                    <span>KES {subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-stone-500">
                                    <span className="opacity-70">TAXES (VAT 16.0%)</span>
                                    <span>KES {tax.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-end pt-3 border-t border-stone-200 mt-3">
                                    <span className="text-[10px] font-black text-stone-400 tracking-wider">TOTAL AMOUNT</span>
                                    <span className="text-xl font-black text-stone-900 tracking-tighter">KES {total.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Modern Payment Selector */}
                                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200">
                                    {(['cash', 'mpesa', 'card'] as const).map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method)}
                                            className={cn(
                                                "py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                                paymentMethod === method ? "bg-white text-stone-900 shadow-sm border border-stone-100" : "text-stone-500 hover:text-stone-700"
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
                                        "w-full h-13 rounded-xl font-black text-[13px] uppercase tracking-[0.1em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-30 disabled:grayscale disabled:active:scale-100 shadow-lg relative overflow-hidden group/btn",
                                        accentBg, accentColor === 'amber' ? "shadow-amber-200" : "shadow-indigo-200",
                                        "text-white"
                                    )}
                                >
                                    {isSubmitting ? (
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white/20 p-1.5 rounded-lg group-hover/btn:scale-110 transition-transform duration-300">
                                                {isRestaurant ? <ChefHat className="h-5 w-5" /> : <ConciergeBell className="h-5 w-5" />}
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
