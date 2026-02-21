'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { restaurantAPI, staffAPI, receiptsAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
  Search, ChefHat, Plus, Minus, X, ShoppingCart,
  Soup, FileText, RefreshCw
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string;
  image_url?: string;
  is_available: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  notes?: string;
}

interface TodayOrder {
  id: string;
  order_number: string;
  order_type: string;
  table_number?: string;
  room_number?: string;
  status: string;
  total: number;
  created_at: string;
  payment_method?: string;
  waiter_id?: string;
  waiter_name?: string;
  items?: Array<{
    name: string;
    quantity: number;
    unit_price: number;
  }>;
}

interface Waiter {
  id: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'inactive';
}

interface POSTabProps {
  onOrderCreated?: () => void;
}

export function POSTab({ onOrderCreated }: POSTabProps) {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();

  // Menu state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'room_service'>('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Today's orders
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([]);
  const [isGeneratingBill, setIsGeneratingBill] = useState<string | null>(null);

  // Waiters
  const [waiters, setWaiters] = useState<Waiter[]>([]);

  // Barcode scanning state
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchMenuData = useCallback(async () => {
    try {
      const [itemsRes, categoriesRes, waitersRes] = await Promise.all([
        restaurantAPI.getMenuItems(undefined, currentBranchId || undefined, true),
        restaurantAPI.getCategories(),
        staffAPI.getWaiters(currentBranchId || undefined)
      ]);

      if (itemsRes.success) setMenuItems(itemsRes.data || []);
      if (categoriesRes.success) setCategories(categoriesRes.data || []);
      if (waitersRes.success) {
        // Map backend response to frontend format
        const mappedWaiters = (waitersRes.data || []).map((w: any) => ({
          id: w.id,
          first_name: w.user?.first_name || w.first_name || '',
          last_name: w.user?.last_name || w.last_name || '',
          status: w.status || 'active'
        })).filter((w: Waiter) => w.status === 'active');
        setWaiters(mappedWaiters);
      }
    } catch (error) {
      console.error('Error fetching menu:', error);
    }
  }, [currentBranchId]);

  const fetchTodayOrders = useCallback(async () => {
    if (!currentBranchId) return;
    try {
      const response = await restaurantAPI.getTodayOrders(currentBranchId);
      if (response.success) setTodayOrders(response.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  }, [currentBranchId]);

  useEffect(() => {
    fetchMenuData();
    fetchTodayOrders();
  }, [fetchMenuData, fetchTodayOrders]);

  // Barcode Scanner Listener
  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;

      // Barcode scanners typically input very fast (< 50ms between chars)
      // If time between keys is > 100ms, reset buffer (user is typing manually)
      if (timeDiff > 100) {
        barcodeBufferRef.current = '';
      }

      lastKeyTimeRef.current = currentTime;

      // Handle Enter key (barcode scan complete)
      if (e.key === 'Enter' && barcodeBufferRef.current.length > 0) {
        e.preventDefault();
        const barcode = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = '';

        // Search for item by barcode/name
        try {
          const res = await restaurantAPI.getMenuItems(undefined, currentBranchId || undefined, true);
          if (res.success && res.data) {
            // Try exact match first (case-insensitive)
            const item = res.data.find((i: MenuItem) =>
              i.name.toLowerCase() === barcode.toLowerCase() ||
              i.name.toLowerCase().includes(barcode.toLowerCase())
            );

            if (item && item.is_available) {
              addToCart(item);
              toast.success(`Added: ${item.name}`);
            } else {
              toast.error(`Item not found: ${barcode}`);
            }
          }
        } catch (error) {
          console.error('Barcode scan error:', error);
        }
      } else if (e.key.length === 1) {
        // Accumulate character
        barcodeBufferRef.current += e.key;

        // Clear buffer after 200ms of inactivity
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }
        barcodeTimeoutRef.current = setTimeout(() => {
          barcodeBufferRef.current = '';
        }, 200);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [currentBranchId, menuItems]);

  const addToCart = (item: MenuItem) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = item.quantity + change;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setTableNumber('');
    setRoomNumber('');
    setCustomerName('');
    setSelectedWaiterId('');
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (orderType === 'dine_in' && !tableNumber) {
      toast.error('Please enter table number');
      return;
    }
    if (orderType === 'dine_in' && !selectedWaiterId) {
      toast.error('Please select a waiter for dine-in orders');
      return;
    }
    if (orderType === 'room_service' && !roomNumber) {
      toast.error('Please enter room number');
      return;
    }

    setIsSubmitting(true);
    try {
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const subtotal = Math.round(total / 1.16);
      const tax = total - subtotal;

      const orderItems = cart.map((item) => ({
        menu_item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_amount: item.price * item.quantity,
        notes: item.notes,
      }));

      const selectedWaiter = waiters.find(w => w.id === selectedWaiterId);

      const orderData = {
        order_type: orderType,
        table_number: orderType === 'dine_in' ? tableNumber : undefined,
        room_number: orderType === 'room_service' ? roomNumber : undefined,
        customer_name: customerName || undefined,
        payment_method: paymentMethod,
        waiter_id: selectedWaiterId || undefined,
        waiter_name: selectedWaiter ? `${selectedWaiter.first_name} ${selectedWaiter.last_name}` : undefined,
        branch_id: currentBranchId,
        items: orderItems,
        subtotal,
        tax,
        total,
        status: 'pending',
      };

      const response = await restaurantAPI.createOrder(orderData);
      const orderNumber = response.data?.order_number || `ORD-${Date.now().toString().slice(-6)}`;

      toast.success(`Order #${orderNumber} created successfully!`);
      clearCart();
      fetchTodayOrders();
      onOrderCreated?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateBill = async (order: TodayOrder) => {
    setIsGeneratingBill(order.id);
    try {
      console.log('[POS] ========== BILL GENERATION DEBUG ==========');
      console.log('[POS] Full order object:', JSON.stringify(order, null, 2));
      console.log('[POS] User object:', JSON.stringify(user, null, 2));
      console.log('[POS] Order waiter_name:', order.waiter_name);
      console.log('[POS] User firstName:', user?.firstName);
      console.log('[POS] User lastName:', user?.lastName);
      
      const servedBy = order.waiter_name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Staff');
      console.log('[POS] Final served_by value:', servedBy);
      console.log('[POS] ===============================================');
      
      const receiptData = {
        receipt_type: 'sale' as const,
        receipt_number: order.order_number,
        date: new Date(order.created_at).toLocaleString(),
        table_number: order.table_number,
        room_number: order.room_number,
        customer_name: order.table_number ? `Table ${order.table_number}` : 'Walk-in',
        cashier_name: user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Staff',
        served_by: servedBy,
        items: order.items?.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.unit_price * item.quantity
        })) || [],
        total_amount: order.total,
        subtotal: Math.round(order.total / 1.16),
        tax_amount: order.total - Math.round(order.total / 1.16),
        payment_method: order.payment_method || 'Cash',
        amount_paid: order.total,
        change_amount: 0
      };

      // Try thermal printing first
      try {
        const printResult = await receiptsAPI.printReceipt(receiptData);
        if (printResult.success) {
          toast.success('Receipt printed successfully!');
          return;
        }
      } catch (printError) {
        console.log('Thermal printing failed, falling back to PDF');
      }

      // Fallback to PDF generation
      const response = await restaurantAPI.generateBill(receiptData);

      if (response.success) {
        if (response.data?.pdf_base64) {
          // Online mode: Download PDF
          const byteCharacters = atob(response.data.pdf_base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = response.data.filename || `bill_${order.order_number}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          toast.success(`Bill generated for Order #${order.order_number}!`);
        } else {
          // Offline mode: Show success message (receipt data is already in receiptData)
          console.log('[POS] Offline mode - bill generated without PDF');
          console.log('[POS] Receipt data:', receiptData);
          toast.success(`Bill generated for Order #${order.order_number} (Offline Mode)`);
        }
      } else {
        throw new Error(response.message || 'Failed to generate bill');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate bill');
    } finally {
      setIsGeneratingBill(null);
    }
  };

  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && item.is_available;
  });

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const subtotal = Math.round(total / 1.16);
  const tax = total - subtotal;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Menu Items */}
      <div className="flex-1 overflow-hidden">
        <div className="bg-white border border-gray-200 rounded-lg flex flex-col min-h-0">
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="flex items-center justify-between lg:hidden mb-2">
              <h1 className="text-xl font-bold text-stone-900">Menu</h1>
              <IOSButton size="sm" variant="secondary" onClick={() => {
                const cartElement = document.getElementById('cart-section');
                cartElement?.scrollIntoView({ behavior: 'smooth' });
              }} className="relative">
                <ShoppingCart className="h-4 w-4" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                    {cart.reduce((a, b) => a + b.quantity, 0)}
                  </span>
                )}
              </IOSButton>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-9 pr-3 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:bg-white"
              />
            </div>
          </div>

          <div className="p-4 border-b border-gray-200 bg-stone-50/50">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                className={`px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-all ${selectedCategory === 'all'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                onClick={() => setSelectedCategory('all')}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-all ${selectedCategory === cat.id
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 pb-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-white border border-stone-200 rounded-xl p-3 cursor-pointer hover:shadow-md transition-all active:scale-95 group"
                >
                  <div className="aspect-square bg-stone-50 rounded-lg mb-2.5 flex items-center justify-center overflow-hidden relative">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <Soup className="h-8 w-8 text-stone-300" />
                    )}
                    <div className="absolute top-1 right-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-amber-500 text-white p-1 rounded-full shadow-sm">
                        <Plus className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                  <h3 className="font-semibold text-[13px] leading-tight mb-1 line-clamp-2 text-stone-800 h-8 lg:h-7">{item.name}</h3>
                  <p className="text-amber-600 font-bold text-sm">KES {item.price.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cart & Orders */}
      <div id="cart-section" className="w-full lg:w-96 flex flex-col gap-4">
        {/* Current Order */}
        <div className="bg-white border border-gray-200 rounded-lg flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-base font-medium text-gray-900">Current Order</h2>

            {/* Order Type */}
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
              {(['dine_in', 'takeaway', 'room_service'] as const).map((type) => (
                <button
                  key={type}
                  className={`px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap transition-all ${orderType === type
                    ? 'bg-stone-800 text-white shadow-sm'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  onClick={() => setOrderType(type)}
                >
                  {type === 'dine_in' ? 'Dine In' : type === 'takeaway' ? 'Takeaway' : 'Room Service'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 mt-4">
              {/* Table/Room Number */}
              {orderType === 'dine_in' && (
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">Table Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 12"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full h-11 px-3 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-400/20 focus:bg-white transition-all"
                  />
                </div>
              )}
              {orderType === 'room_service' && (
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">Room Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 204"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full h-11 px-3 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-400/20 focus:bg-white transition-all"
                  />
                </div>
              )}

              {/* Waiter Selection */}
              {orderType === 'dine_in' && (
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">Assigned Waiter *</label>
                  <select
                    value={selectedWaiterId}
                    onChange={(e) => setSelectedWaiterId(e.target.value)}
                    className="w-full h-11 px-3 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-400/20 focus:bg-white transition-all"
                    required
                  >
                    <option value="">Select waiter</option>
                    {waiters.map((waiter) => (
                      <option key={waiter.id} value={waiter.id}>
                        {waiter.first_name} {waiter.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs">Tap items to add</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 bg-stone-50 rounded-ios-lg border border-stone-100 hover:border-stone-200 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[13px] text-stone-800 truncate">{item.name}</p>
                      <p className="text-amber-600 text-[12px] font-medium">KES {(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg p-0.5">
                      <button
                        className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-[13px] font-bold text-stone-700">{item.quantity}</span>
                      <button
                        className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-500 ml-0.5"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="p-4 border-t border-gray-200 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal (excl. VAT)</span>
                <span>KES {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>VAT (16% incl.)</span>
                <span>KES {tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-medium text-gray-900 pt-1 border-t border-gray-200">
                <span>TOTAL</span>
                <span>KES {total.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-stone-50 p-3 rounded-lg border border-stone-100">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Payment Method</p>
              <div className="flex gap-2">
                {(['cash', 'mpesa', 'card'] as const).map((method) => (
                  <button
                    key={method}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${paymentMethod === method
                      ? 'bg-white text-stone-900 shadow-sm border border-stone-200 ring-2 ring-amber-400/50'
                      : 'bg-stone-200/50 text-stone-600 border border-transparent hover:bg-stone-200'
                      }`}
                    onClick={() => setPaymentMethod(method)}
                  >
                    {method === 'mpesa' ? 'M-Pesa' : method.charAt(0).toUpperCase() + method.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleCreateOrder}
                disabled={cart.length === 0 || isSubmitting || (orderType === 'dine_in' && !selectedWaiterId)}
                className="w-full bg-stone-800 text-white font-bold h-12 rounded-xl shadow-lg shadow-stone-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ChefHat className="h-5 w-5" />
                    <span>Send to Kitchen</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    // Generate bill for current cart items
                    if (cart.length === 0) {
                      toast.error('Cart is empty');
                      return;
                    }
                    if (orderType === 'dine_in' && !selectedWaiterId) {
                      toast.error('Please select a waiter');
                      return;
                    }
                    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    const subtotal = Math.round(total / 1.16);
                    const tax = total - subtotal;
                    const selectedWaiter = waiters.find(w => w.id === selectedWaiterId);
                    const waiterName = selectedWaiter ? `${selectedWaiter.first_name} ${selectedWaiter.last_name}` : undefined;
                    
                    console.log('[POS Bill Button] Selected waiter:', selectedWaiter);
                    console.log('[POS Bill Button] Waiter name:', waiterName);
                    console.log('[POS Bill Button] User:', user);
                    
                    handleGenerateBill({
                      id: 'current-cart',
                      order_number: `ORD-${Date.now().toString().slice(-6)}`,
                      order_type: orderType,
                      table_number: orderType === 'dine_in' ? tableNumber : undefined,
                      room_number: orderType === 'room_service' ? roomNumber : undefined,
                      status: 'pending',
                      total: total,
                      created_at: new Date().toISOString(),
                      payment_method: paymentMethod,
                      waiter_id: selectedWaiterId || undefined,
                      waiter_name: waiterName,
                      items: cart.map(item => ({ name: item.name, quantity: item.quantity, unit_price: item.price }))
                    } as TodayOrder);
                  }}
                  disabled={cart.length === 0}
                  className="bg-white border-2 border-stone-200 text-stone-700 font-bold h-11 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  <span>Bill</span>
                </button>

                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="bg-white border-2 border-red-100 text-red-500 font-bold h-11 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <X className="h-4 w-4" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
