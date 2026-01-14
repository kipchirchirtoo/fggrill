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
    AlertCircle, Info, Trash2, User as UserIcon,
    Grid, List, ChevronDown, ArrowRight
} from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
        <div className="h-full bg-stone-50 flex flex-col w-full text-stone-900 border-t border-stone-200">
            {/* Redesigned Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4 max-w-[1700px]">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-stone-200", accentBg)}>
                            {isRestaurant ? 'R' : 'B'}
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight leading-none">{isRestaurant ? 'Famous Gate' : 'Famous Bar'}</h1>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">Point of Sale</p>
                        </div>
                    </div>

                    <div className="flex-1 max-w-xl">
                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4 group-focus-within:text-stone-900 transition-colors" />
                            <input
                                type="text"
                                placeholder={`Search ${isRestaurant ? 'menu' : 'drinks'}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-stone-100/50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:bg-white transition-all font-medium text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                            className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors bg-white shadow-sm"
                        >
                            {viewMode === 'grid' ? <List className="w-4 h-4 text-stone-600" /> : <Grid className="w-4 h-4 text-stone-600" />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-row container mx-auto p-4 gap-4 overflow-hidden max-w-[1700px]">
                {/* Left Side - Product Explorer */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Horizontal Categories Tabs */}
                    <div className="bg-white rounded-2xl border border-stone-200 p-2 mb-4 shrink-0 shadow-sm overflow-x-auto no-scrollbar">
                        <div className="flex gap-1 min-w-max">
                            <button
                                onClick={() => setSelectedCategoryId('all')}
                                className={cn(
                                    "px-5 py-2 rounded-xl font-bold transition-all text-sm whitespace-nowrap",
                                    selectedCategoryId === 'all'
                                        ? "bg-stone-900 text-white shadow-md shadow-stone-200"
                                        : "hover:bg-stone-50 text-stone-500"
                                )}
                            >
                                ALL ITEMS
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={cn(
                                        "px-5 py-2 rounded-xl font-bold transition-all text-sm whitespace-nowrap uppercase",
                                        selectedCategoryId === cat.id
                                            ? "bg-stone-900 text-white shadow-md shadow-stone-200"
                                            : "hover:bg-stone-50 text-stone-500"
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dynamic Products Grid/List */}
                    <div className="flex-1 bg-white rounded-[2rem] border border-stone-200 p-4 md:p-6 overflow-y-auto no-scrollbar shadow-sm">
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
                                "grid gap-4",
                                viewMode === 'grid'
                                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6"
                                    : "grid-cols-1"
                            )}>
                                {filteredItems.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className={cn(
                                            "group cursor-pointer bg-white border border-stone-100 rounded-3xl hover:border-stone-900 hover:shadow-2xl hover:shadow-stone-200 transition-all duration-300 relative",
                                            viewMode === 'grid' ? "p-4 flex flex-col" : "p-3 flex flex-row items-center gap-4"
                                        )}
                                    >
                                        <div className={cn(
                                            "rounded-2xl transition-all overflow-hidden bg-stone-50 flex items-center justify-center shrink-0",
                                            viewMode === 'grid' ? "aspect-square w-full mb-4" : "w-16 h-16"
                                        )}>
                                            {item.image_url ? (
                                                <Image src={item.image_url} alt={item.name} width={200} height={200} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className={cn("h-full w-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform duration-500 opacity-60", accentText)}>
                                                    {isRestaurant ? <UtensilsCrossed className="w-10 h-10 opacity-10" /> : <WineIcon className="w-10 h-10 opacity-10" />}
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

                {/* Right Side - Cart Section (Elastic Panel) */}
                <div className="w-80 lg:w-96 flex-shrink-0 flex flex-col bg-white rounded-[2.5rem] border border-stone-200 shadow-2xl shadow-stone-200/50 overflow-hidden relative">
                    {/* Cart Header with System Data */}
                    <div className="p-6 border-b border-stone-100 bg-white/50 backdrop-blur-sm sticky top-0 z-20">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", accentBg)}>
                                    <ShoppingCart className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-stone-900 tracking-tight">CART</h2>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{cart.length} items</p>
                                </div>
                            </div>
                            {cart.length > 0 && (
                                <button onClick={clearCart} className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-red-500 transition-colors bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200">Empty</button>
                            )}
                        </div>

                        {/* System Context Badges */}
                        <div className="space-y-3">
                            {isRestaurant ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl">
                                        {(['dine_in', 'takeaway', 'room_service'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setOrderType(type)}
                                                className={cn(
                                                    "py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                                    orderType === type ? "bg-white text-stone-900 shadow-sm border border-stone-100" : "text-stone-500 hover:text-stone-700"
                                                )}
                                            >
                                                {type === 'dine_in' ? 'Dine In' : type === 'takeaway' ? 'Takeaway' : 'Room'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        {(orderType === 'dine_in') && (
                                            <input
                                                placeholder="T#"
                                                value={tableNumber}
                                                onChange={e => setTableNumber(e.target.value)}
                                                className="w-20 bg-stone-50 border border-stone-200 text-stone-900 rounded-xl h-11 px-3 focus:ring-2 focus:ring-stone-900/5 text-xs font-bold placeholder:text-stone-400 transition-all font-mono"
                                            />
                                        )}
                                        {orderType === 'room_service' && (
                                            <input
                                                placeholder="ROOM"
                                                value={roomNumber}
                                                onChange={e => setRoomNumber(e.target.value)}
                                                className="w-24 bg-stone-50 border border-stone-200 text-stone-900 rounded-xl h-11 px-3 focus:ring-2 focus:ring-stone-900/5 text-xs font-bold placeholder:text-stone-400 transition-all font-mono"
                                            />
                                        )}
                                        <div className="flex-1 bg-stone-50 border border-stone-200 rounded-xl h-11 px-3 flex items-center justify-center text-[10px] font-black text-stone-600 truncate border-dashed">
                                            <UserIcon className="h-3.5 w-3.5 mr-2 opacity-30" />
                                            {user?.firstName?.toUpperCase()}
                                        </div>
                                    </div>
                                    {orderType === 'takeaway' && (
                                        <input placeholder="CUSTOMER NAME" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-stone-100 border-none text-stone-900 rounded-xl h-11 px-4 focus:ring-2 focus:ring-stone-900/5 text-xs font-bold placeholder:text-stone-400" />
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <select
                                            value={selectedTabId}
                                            onChange={e => setSelectedTabId(e.target.value)}
                                            className="w-full h-12 px-4 bg-stone-100 border-none text-stone-900 rounded-xl text-[11px] font-black appearance-none cursor-pointer focus:ring-2 focus:ring-stone-900/5 tracking-wider"
                                        >
                                            <option value="">WALK-IN ORDER</option>
                                            {openTabs.map(t => <option key={t.id} value={t.id}>TAB #{t.tab_number} - {t.customer_name?.toUpperCase()}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                                    </div>
                                    {!selectedTabId && (
                                        <input placeholder="SEAT / TABLE #" value={tableNumber} onChange={e => setTableNumber(e.target.value)} className="w-full bg-stone-100 border-none text-stone-900 rounded-xl h-12 px-4 focus:ring-2 focus:ring-stone-900/5 text-xs font-bold placeholder:text-stone-400" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Items List */}
                    <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-stone-300 opacity-60">
                                <ShoppingCart className="w-20 h-20 mb-4 opacity-10" />
                                <p className="text-xs font-black uppercase tracking-widest text-stone-400">Cart is empty</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.id} className="relative group bg-stone-50 hover:bg-white border border-stone-100 hover:border-stone-900 rounded-2xl p-4 transition-all duration-300">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-stone-900 text-sm truncate">{item.name}</h4>
                                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">KES {item.price.toLocaleString()}</p>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-stone-300 hover:text-red-500 transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex items-center bg-white border border-stone-200 rounded-xl p-0.5 shadow-sm">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-stone-50 text-stone-500 rounded-lg transition-colors">
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-10 text-center text-xs font-black">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 hover:bg-stone-50 text-stone-500 rounded-lg transition-colors">
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <span className="text-sm font-black text-stone-900">KES {(item.price * item.quantity).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Cart Footer / Summary */}
                    {cart.length > 0 && (
                        <div className="p-6 bg-stone-900 border-t border-stone-800 rounded-t-[2rem] shadow-2xl relative z-30">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-stone-500 text-[10px] font-black uppercase tracking-widest">
                                        <span>Subtotal (Net)</span>
                                        <span className="text-stone-300 font-mono">KES {subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-stone-500 text-[10px] font-black uppercase tracking-widest">
                                        <span>VAT (16% Included)</span>
                                        <span className="text-stone-300 font-mono">KES {tax.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-stone-800">
                                    <span className="text-stone-400 text-xs font-black uppercase tracking-[0.2em]">Total Amount</span>
                                    <div className="text-right">
                                        <span className="text-white text-2xl font-black tracking-tight leading-none">KES {total.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Payment Method Selector */}
                                <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-800 rounded-xl">
                                    {(['cash', 'mpesa', 'card'] as const).map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method)}
                                            className={cn(
                                                "py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                                paymentMethod === method ? "bg-stone-100 text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-400"
                                            )}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={handleCreateOrder}
                                    disabled={isSubmitting}
                                    className={cn(
                                        "w-full py-4 rounded-2xl text-white font-black uppercase tracking-[0.2em] text-xs transition-all shadow-xl flex items-center justify-center gap-3",
                                        accentBg,
                                        isSubmitting ? "opacity-50 cursor-not-allowed scale-95" : "hover:brightness-110 active:scale-95 shadow-amber-500/20"
                                    )}
                                >
                                    {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin text-white/50" /> : 'Confirm Order'}
                                    {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
