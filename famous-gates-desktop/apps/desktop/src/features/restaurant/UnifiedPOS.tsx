'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBranch } from '../../hooks/useBranch';
import { restaurantAPI, barAPI, staffAPI, receiptsAPI } from '../../services/api/api';
import { toast } from 'sonner';
import {
    Search, ChefHat, Plus, Minus, X, ShoppingCart,
    UtensilsCrossed, Wine, FileText, RefreshCw,
    WineIcon, ConciergeBell, History, Layers, Check,
    AlertCircle, Info, Trash2, User as UserIcon,
    Grid, List, ChevronDown, ArrowRight, LogOut, Bell
} from 'lucide-react';
import { IOSButton } from '../../components/ui/IOSButton';
import { cn } from '../../utils/cn';
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
    const { session, logout } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();
    const currentBranchId = activeBranchId || session?.branch_id;
    const user = session; // Map session to user for compatibility

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
    const [historyStatus, setHistoryStatus] = useState<string>('all');
    const [waiterFilter, setWaiterFilter] = useState<string>('my-orders');
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
            const orderDate = new Date(order.created_at);
            const isSameDate = orderDate.toDateString() === historyDate.toDateString();

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

            let matchesWaiter = true;
            if (waiterFilter === 'my-orders') {
                matchesWaiter = order.created_by === session?.user_id || order.waiter_id === session?.user_id;
            }

            return isSameDate && matchesStatus && matchesWaiter;
        });
    }, [recentOrders, historyDate, historyStatus, waiterFilter, session?.user_id]);

    const handleVoidOrder = async () => {
        if (!isVoiding || !voidReason.trim()) return;

        try {
            const api = isRestaurant ? restaurantAPI : barAPI;
            const res = await api.updateOrderStatus(isVoiding, 'cancelled');

            if (res.success) {
                toast.success('Order voided successfully');
                setIsVoiding(null);
                setVoidReason('');
                setVoidConfirmOpen(false);
                fetchData();
            } else {
                toast.error('Failed to void order');
            }
        } catch (error) {
            console.error('Void error', error);
            toast.error('Error voiding order');
        }
    };

    const handleEditOrder = async (order: any) => {
        if (order.table_number) setTableNumber(order.table_number);
        if (order.room_number) {
            setRoomNumber(order.room_number);
            setOrderType('room_service');
        }
        if (order.guest_name || order.customer_name) {
            setCustomerName(order.guest_name || order.customer_name);
        }
        if (order.order_type) setOrderType(order.order_type);

        sessionStorage.setItem('editing_order_id', order.id);
        setCart([]);
        setShowHistory(false);
        toast.info('Add new items to this order. Only new items will be added.');
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
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
                    restaurantAPI.getMenuItems(undefined, Number(currentBranchId) || undefined) as Promise<any>,
                    restaurantAPI.getCategories(Number(currentBranchId) || undefined) as Promise<any>
                ]);

                if (itemsRes.success) setItems(itemsRes.data || []);
                if (categoriesRes.success) setCategories(categoriesRes.data || []);
            } else {
                const [drinksRes, categoriesRes] = await Promise.all([
                    barAPI.getDrinks(undefined, Number(currentBranchId) || undefined) as Promise<any>,
                    barAPI.getCategories(Number(currentBranchId) || undefined) as Promise<any>
                ]);

                if (drinksRes.success) setItems(drinksRes.data || []);
                if (categoriesRes.success) setCategories(categoriesRes.data || []);
            }

            if (session?.user_id) {
                const ordersRes = isRestaurant
                    ? await restaurantAPI.getOrders({
                        branch_id: currentBranchId,
                        from_date: startOfDay.toISOString().split('T')[0],
                        to_date: endOfDay.toISOString().split('T')[0]
                    }) as any
                    : await barAPI.getOrders({
                        branchId: Number(currentBranchId) || undefined,
                        from_date: startOfDay.toISOString().split('T')[0],
                        to_date: endOfDay.toISOString().split('T')[0]
                    }) as any;

                if (ordersRes.success) {
                    setRecentOrders(ordersRes.data || []);
                }
            }
        } catch (error) {
            console.error(`Error fetching ${mode} data:`, error);
            toast.error(`Failed to load ${mode} menu`);
        } finally {
            setIsLoading(false);
        }
    }, [mode, currentBranchId, isRestaurant, historyDate, session?.user_id]);

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
        setIsPrinting(orderData.id);
        try {
            await receiptsAPI.printReceipt({
                ...orderData,
                branch: activeBranch,
                user: {
                    firstName: session?.email.split('@')[0] || 'Staff',
                    lastName: ''
                }
            });
            toast.success('Sent to printer');
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

        setIsSubmitting(true);
        try {
            const orderData = {
                order_type: orderType,
                table_number: orderType === 'dine_in' ? tableNumber : undefined,
                room_number: orderType === 'room_service' ? roomNumber : undefined,
                customer_name: customerName || undefined,
                payment_method: paymentMethod,
                waiter_id: session?.user_id,
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

            const api = isRestaurant ? restaurantAPI : barAPI;
            const res = await api.createOrder(orderData);
            
            if (res.success) {
                toast.success(`${mode === 'restaurant' ? 'Restaurant' : 'Bar'} order placed!`);
                await handlePrintReceipt(res.data || { ...orderData, id: 'local-' + Date.now() });
                clearCart();
                fetchData();
                onOrderCreated?.();
            } else {
                throw new Error(res.message);
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to process order');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-full bg-stone-50 flex flex-col w-full text-stone-900 overflow-hidden">
            <div className="flex-1 flex flex-row w-full overflow-hidden min-h-0 bg-stone-100/50">
                {/* Left Side - Product Explorer */}
                <div className="flex-1 flex flex-col min-w-0 p-3 md:p-4">
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
                                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
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
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
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

                {/* Right Side - Cart Section */}
                <div className="w-72 md:w-80 flex-shrink-0 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden border border-stone-200 h-full">
                    <div className="p-3 md:p-3.5 border-b border-stone-200 flex items-center justify-between bg-stone-50/50 relative z-20">
                        <div className="flex items-center gap-2">
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-md", accentBg)}>
                                {mode === 'restaurant' ? 'R' : 'B'}
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-black text-stone-900 uppercase tracking-tight leading-none">{session?.email.split('@')[0]}</p>
                                <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest leading-none mt-0.5">{session?.role}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowHistory(true)}
                                className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-100 transition-all text-stone-400 hover:text-blue-600"
                            >
                                <History className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => logout()}
                                className="p-1.5 rounded-lg hover:bg-red-50 hover:shadow-sm border border-transparent hover:border-red-100 transition-all text-stone-400 hover:text-red-500"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="p-3 md:p-4 border-b border-stone-200 flex items-center justify-between bg-white flex-none">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 md:w-5 h-4 md:h-5 text-blue-600" />
                            <h2 className="text-lg md:text-xl font-bold text-gray-800">Cart</h2>
                            <span className="bg-blue-600 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </span>
                        </div>
                        {cart.length > 0 && (
                            <button onClick={clearCart} className="text-red-600 hover:text-red-700 text-xs font-medium flex items-center gap-1">
                                <Trash2 className="w-3 h-3" />
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="px-3 md:px-4 py-3 border-b border-stone-100 bg-stone-50/30 flex-none">
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
                                                    orderType === type ? "bg-blue-600 text-white shadow-md" : "text-stone-600 hover:bg-white"
                                                )}
                                            >
                                                {type === 'dine_in' ? 'Dine In' : type === 'takeaway' ? 'Takeaway' : 'Room'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        {orderType === 'dine_in' && (
                                            <input
                                                placeholder="T#"
                                                value={tableNumber}
                                                onChange={e => setTableNumber(e.target.value)}
                                                className="w-full bg-white border border-stone-200 rounded-lg h-9 px-3 text-xs font-bold"
                                            />
                                        )}
                                        {orderType === 'room_service' && (
                                            <input
                                                placeholder="ROOM"
                                                value={roomNumber}
                                                onChange={e => setRoomNumber(e.target.value)}
                                                className="w-full bg-white border border-stone-200 rounded-lg h-9 px-3 text-xs font-bold"
                                            />
                                        )}
                                    </div>
                                    <input
                                        placeholder="CUSTOMER NAME"
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        className="w-full bg-white border border-stone-200 rounded-lg h-9 px-4 text-xs font-bold"
                                    />
                                </div>
                            ) : (
                                <input
                                    placeholder="SEAT / TABLE #"
                                    value={tableNumber}
                                    onChange={e => setTableNumber(e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-lg h-10 px-4 text-xs font-bold"
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex-1 relative min-h-0">
                        <div className="absolute inset-0 overflow-y-auto no-scrollbar p-3 md:p-4 space-y-3">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-stone-300">
                                    <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                                    <p className="text-xs font-medium uppercase tracking-wider text-stone-400">Empty Cart</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="bg-stone-50/50 hover:bg-white border border-stone-200 rounded-lg p-2 md:p-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-stone-800 text-sm truncate">{item.name}</h4>
                                                <p className="text-[10px] text-stone-500">KES {item.price.toLocaleString()}</p>
                                            </div>
                                            <button onClick={() => removeFromCart(item.id)} className="text-stone-300 hover:text-red-500">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-stone-50"><Minus className="w-2.5 h-2.5" /></button>
                                                <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-stone-50"><Plus className="w-2.5 h-2.5" /></button>
                                            </div>
                                            <span className="text-sm font-bold text-blue-600">KES {(item.price * item.quantity).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {cart.length > 0 && (
                        <div className="p-3 md:p-4 bg-white border-t border-stone-200 space-y-3 flex-none">
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span>Subtotal</span><span className="font-bold">KES {subtotal.toLocaleString()}</span></div>
                                <div className="flex justify-between pt-1 border-t text-base font-black">
                                    <span>Total</span><span className="text-blue-600">KES {total.toLocaleString()}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleCreateOrder}
                                disabled={isSubmitting}
                                className={cn(
                                    "w-full py-3 rounded-lg text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2",
                                    isSubmitting ? "bg-stone-400" : "bg-blue-600 hover:bg-blue-700"
                                )}
                            >
                                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Place Order'}
                                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Simple History Modal Overlay */}
            <AnimatePresence>
                {showHistory && (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col p-6 shadow-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Recent Orders</h2>
                                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-stone-100 rounded-full"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                                {recentOrders.map(order => (
                                    <div key={order.id} className="p-4 border border-stone-100 rounded-xl bg-stone-50/50 flex items-center justify-between">
                                        <div>
                                            <p className="font-bold">#{order.order_number || order.id.slice(0, 8)}</p>
                                            <p className="text-xs text-stone-500">{new Date(order.created_at).toLocaleTimeString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black">KES {order.total_amount?.toLocaleString()}</p>
                                            <button onClick={() => handlePrintReceipt(order)} className="text-[10px] font-bold text-blue-600 uppercase mt-1">Print</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
