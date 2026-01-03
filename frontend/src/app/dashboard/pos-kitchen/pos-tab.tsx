'use client';

import { useState, useEffect, useCallback } from 'react';
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
      const receiptData = {
        receipt_type: 'sale' as const,
        receipt_number: order.order_number,
        date: new Date(order.created_at).toLocaleString(),
        table_number: order.table_number,
        room_number: order.room_number,
        customer_name: order.table_number ? `Table ${order.table_number}` : 'Walk-in',
        cashier_name: user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Staff',
        served_by: order.waiter_name || undefined,
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
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bill_${order.order_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success(`Bill generated for Order #${order.order_number}!`);
      } else {
        throw new Error('Failed to generate bill');
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
        <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-base font-medium text-gray-900">Menu Items</h2>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-3 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white"
              />
            </div>
          </div>

          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                className={`px-3 py-1 text-sm rounded whitespace-nowrap ${selectedCategory === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                onClick={() => setSelectedCategory('all')}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`px-3 py-1 text-sm rounded whitespace-nowrap ${selectedCategory === cat.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <div className="w-6 h-6 bg-gray-300 rounded"></div>
                    )}
                  </div>
                  <h3 className="font-medium text-sm mb-1 line-clamp-2 text-gray-900">{item.name}</h3>
                  <p className="text-gray-900 font-medium text-sm">KES {item.price.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cart & Orders */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Current Order */}
        <div className="bg-white border border-gray-200 rounded-lg flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-base font-medium text-gray-900">Current Order</h2>

            {/* Order Type */}
            <div className="flex gap-2 mt-3">
              {(['dine_in', 'takeaway', 'room_service'] as const).map((type) => (
                <button
                  key={type}
                  className={`px-3 py-1 text-sm rounded ${orderType === type
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  onClick={() => setOrderType(type)}
                >
                  {type === 'dine_in' ? 'Dine In' : type === 'takeaway' ? 'Takeaway' : 'Room'}
                </button>
              ))}
            </div>

            {/* Table/Room Number */}
            {orderType === 'dine_in' && (
              <input
                type="text"
                placeholder="Table Number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full mt-3 h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white"
              />
            )}
            {orderType === 'room_service' && (
              <input
                type="text"
                placeholder="Room Number"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="w-full mt-3 h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white"
              />
            )}

            {/* Waiter Selection */}
            {orderType === 'dine_in' && (
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Assign Waiter</label>
                <select
                  value={selectedWaiterId}
                  onChange={(e) => setSelectedWaiterId(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white"
                  required
                >
                  <option value="">Select waiter *</option>
                  {waiters.map((waiter) => (
                    <option key={waiter.id} value={waiter.id}>
                      {waiter.first_name} {waiter.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                  <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{item.name}</p>
                      <p className="text-gray-600 text-sm">KES {(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs font-medium"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs font-medium"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        +
                      </button>
                      <button
                        className="w-6 h-6 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs font-medium ml-1"
                        onClick={() => removeFromCart(item.id)}
                      >
                        ×
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
            <div>
              <p className="text-sm font-medium mb-2 text-gray-900">Payment Method</p>
              <div className="flex gap-2">
                {(['cash', 'mpesa', 'card'] as const).map((method) => (
                  <button
                    key={method}
                    className={`px-3 py-1 text-sm rounded ${paymentMethod === method
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    onClick={() => setPaymentMethod(method)}
                  >
                    {method === 'mpesa' ? 'M-Pesa' : method.charAt(0).toUpperCase() + method.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleCreateOrder}
                disabled={cart.length === 0 || isSubmitting || (orderType === 'dine_in' && !selectedWaiterId)}
                className="w-full bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating Order...' : 'Send to Kitchen'}
              </button>

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

                  const receiptData = {
                    receipt_type: 'sale' as const,
                    receipt_number: `ORD-${Date.now().toString().slice(-6)}`,
                    date: new Date().toLocaleString(),
                    table_number: orderType === 'dine_in' ? tableNumber : undefined,
                    room_number: orderType === 'room_service' ? roomNumber : undefined,
                    customer_name: customerName || (orderType === 'dine_in' ? `Table ${tableNumber}` : 'Walk-in'),
                    cashier_name: user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Staff',
                    served_by: selectedWaiter ? `${selectedWaiter.first_name} ${selectedWaiter.last_name}` : undefined,
                    items: cart.map(item => ({
                      name: item.name,
                      quantity: item.quantity,
                      unit_price: item.price,
                      total: item.price * item.quantity
                    })),
                    total_amount: total,
                    subtotal: subtotal,
                    tax_amount: tax,
                    payment_method: paymentMethod || 'Cash',
                    amount_paid: total,
                    change_amount: 0
                  };

                  handleGenerateBill({
                    id: 'current-cart',
                    order_number: receiptData.receipt_number,
                    total: total,
                    waiter_name: selectedWaiter ? `${selectedWaiter.first_name} ${selectedWaiter.last_name}` : undefined,
                    items: cart.map(item => ({ name: item.name, quantity: item.quantity, unit_price: item.price }))
                  } as TodayOrder);
                }}
                disabled={cart.length === 0}
                className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Bill
              </button>

              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear Cart
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
