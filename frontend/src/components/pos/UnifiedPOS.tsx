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
    const [userMenuOpen, setUserMenuOpen] = useState(false);

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
                                                <Image src={item.image_url} alt={item.name} width={200} height={200} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
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
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200 transition-all text-stone-500"
                            >
                                <UserIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => logout()}
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
                                    <button className="flex items-center gap-2 w-full p-2 text-xs font-bold text-stone-600 hover:bg-stone-50 rounded-lg transition-all">
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

                            {/* Payment Selection Refined */}
                            <div className="grid grid-cols-3 gap-2 bg-stone-100 p-1 rounded-lg border border-stone-200/50">
                                {(['cash', 'mpesa', 'card'] as const).map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        className={cn(
                                            "py-1.5 text-[10px] md:text-xs font-bold uppercase rounded-md transition-all",
                                            paymentMethod === method
                                                ? "bg-white text-stone-900 shadow-sm border border-stone-100"
                                                : "text-stone-500 hover:text-stone-700"
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
        </div>
    );
}
