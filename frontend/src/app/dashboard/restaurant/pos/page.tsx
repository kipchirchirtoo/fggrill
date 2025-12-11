'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Input } from '@/components/ui/input';
import { restaurantAPI, receiptsAPI } from '@/lib/api';
import { 
  ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Search,
  UtensilsCrossed, Coffee, Soup, X, Check, Printer, User, Download, FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string;
  category_name?: string;
  is_available: boolean;
  image_url?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  notes?: string;
}

interface Category {
  id: string;
  name: string;
}

export default function RestaurantPOSPage() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'room_service'>('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        restaurantAPI.getMenuItems(undefined, undefined, true),
        restaurantAPI.getCategories(),
      ]);

      if (itemsRes.success) setMenuItems(itemsRes.data || []);
      if (categoriesRes.success) setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    return matchesSearch && matchesCategory && item.is_available;
  });

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.id === itemId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setTableNumber('');
    setRoomNumber('');
    setCustomerName('');
  };

  // VAT is ALREADY INCLUDED in menu prices (16%)
  // Total from cart IS the final price - no additional tax to add
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Calculate VAT breakdown for display (VAT is included, not added)
  // If total = base + VAT and VAT = base * 0.16, then total = base * 1.16
  // So base = total / 1.16 and VAT = total - base
  const subtotal = Math.round(total / 1.16);
  const tax = total - subtotal;

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);

  const handleGenerateReceipt = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (orderType === 'dine_in' && !tableNumber) {
      toast.error('Please enter table number');
      return;
    }

    if (orderType === 'room_service' && !roomNumber) {
      toast.error('Please enter room number');
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare order items with names for display
      const orderItems = cart.map((item) => ({
        menu_item_id: item.id,
        item_name: item.name,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_amount: item.price * item.quantity,
        notes: item.notes,
      }));

      const orderData = {
        order_type: orderType,
        table_number: orderType === 'dine_in' ? tableNumber : undefined,
        room_number: orderType === 'room_service' ? roomNumber : undefined,
        customer_name: customerName || undefined,
        payment_method: paymentMethod,
        branch_id: user?.branch_id,
        items: orderItems,
        subtotal,
        tax,
        total,
        status: 'completed',
      };

      // Create the order
      const response = await restaurantAPI.createOrder(orderData);
      const orderNumber = response.data?.order_number || `ORD-${Date.now()}`;
      
      // Also create a receipt record for finance tracking
      try {
        await receiptsAPI.createReceipt({
          receipt_type: 'sale',
          order_id: response.data?.id,
          customer_name: customerName || undefined,
          table_number: orderType === 'dine_in' ? tableNumber : undefined,
          room_number: orderType === 'room_service' ? roomNumber : undefined,
          subtotal,
          tax_rate: 16,
          tax_amount: tax,
          total_amount: total,
          payment_method: paymentMethod,
          amount_paid: total,
          payment_status: 'paid',
          branch_id: user?.branch_id,
          cashier_name: user?.firstName || 'Staff',
          items: orderItems,
        });
      } catch (receiptError) {
        console.error('Failed to create receipt record:', receiptError);
        // Continue even if receipt creation fails
      }
      
      setLastOrder({ 
        ...orderData, 
        items: orderItems,
        order_number: orderNumber, 
        receipt_number: `RCP-${Date.now()}`,
        created_at: new Date().toISOString() 
      });
      setShowReceipt(true);
      toast.success('Receipt generated successfully!');
      clearCart();
    } catch (error: any) {
      toast.error(error.message || 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="flex gap-6 h-[calc(100vh-120px)]">
          {/* Menu Section */}
          <div className="flex-1 flex flex-col">
            {/* Search & Categories */}
            <div className="mb-4 space-y-3">
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center justify-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 text-base bg-[#f5f5f7] border-0 rounded-[1rem] text-[#141417] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white transition-all"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                <IOSButton
                  size="sm"
                  variant={selectedCategory === 'all' ? 'primary' : 'secondary'}
                  onClick={() => setSelectedCategory('all')}
                >
                  All
                </IOSButton>
                {categories.map((cat) => (
                  <IOSButton
                    key={cat.id}
                    size="sm"
                    variant={selectedCategory === cat.id ? 'primary' : 'secondary'}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.name}
                  </IOSButton>
                ))}
              </div>
            </div>

            {/* Menu Grid */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007AFF]" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="group cursor-pointer bg-[#fefefe] rounded-[1rem] p-2 text-[#141417] shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-1 active:scale-[0.98]"
                      onClick={() => addToCart(item)}
                    >
                      {/* Card Hero Section */}
                      <div className="bg-[#fef4e2] rounded-t-[0.5rem] p-4 text-sm">
                        {/* Header with category and availability */}
                        <div className="flex justify-between items-center gap-4 font-bold">
                          <span className="text-xs uppercase tracking-wide text-amber-700">
                            {item.category_name || 'Menu Item'}
                          </span>
                          {item.is_available ? (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              Available
                            </span>
                          ) : (
                            <span className="text-xs text-red-500">Sold Out</span>
                          )}
                        </div>
                        
                        {/* Item Name - Main Title */}
                        <h3 className="my-4 text-xl font-semibold pr-4 leading-tight line-clamp-2">
                          {item.name}
                        </h3>
                        
                        {/* Image */}
                        <div className="relative h-24 w-full overflow-hidden rounded-lg bg-white/50">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Soup className="h-10 w-10 text-amber-600/60" />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Card Footer */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 font-bold text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-[#141417]">
                            KES {item.price?.toLocaleString()}
                          </span>
                        </div>
                        <button 
                          className="w-full sm:w-auto font-normal border-none cursor-pointer text-center py-2 px-5 rounded-[1rem] bg-[#141417] text-white text-sm hover:bg-[#2a2a2f] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item);
                          }}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart Section */}
          <IOSCard className="w-96 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Current Order
              </h2>
              {/* Order Type - Modern Segmented Control */}
              <div className="mt-3">
                <div className="bg-gray-100 p-1 rounded-[1rem] flex gap-1">
                  {(['dine_in', 'takeaway', 'room_service'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className={`flex-1 py-2 px-3 rounded-[0.75rem] text-sm font-medium transition-all ${
                        orderType === type 
                          ? 'bg-white text-[#141417] shadow-sm' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {type === 'dine_in' ? '🍽️ Dine In' : type === 'takeaway' ? '🥡 Takeaway' : '🛎️ Room'}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Table/Room/Customer Input */}
              <div className="mt-3">
                {orderType === 'dine_in' && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🪑</span>
                    <input
                      type="text"
                      placeholder="Table Number"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 text-sm bg-[#f5f5f7] border-0 rounded-[0.75rem] text-[#141417] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                )}
                {orderType === 'room_service' && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🚪</span>
                    <input
                      type="text"
                      placeholder="Room Number"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 text-sm bg-[#f5f5f7] border-0 rounded-[0.75rem] text-[#141417] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                )}
                {orderType === 'takeaway' && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">👤</span>
                    <input
                      type="text"
                      placeholder="Customer Name (optional)"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 text-sm bg-[#f5f5f7] border-0 rounded-[0.75rem] text-[#141417] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2" />
                  <p>Cart is empty</p>
                  <p className="text-sm">Tap items to add</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-ios-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-[#007AFF] text-sm">KES {(item.price * item.quantity).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <IOSButton size="sm" variant="secondary" onClick={() => updateQuantity(item.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </IOSButton>
                        <span className="w-6 text-center font-medium">{item.quantity}</span>
                        <IOSButton size="sm" variant="secondary" onClick={() => updateQuantity(item.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </IOSButton>
                        <IOSButton size="sm" variant="destructive" onClick={() => removeFromCart(item.id)}>
                          <X className="h-3 w-3" />
                        </IOSButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals & Actions - VAT is INCLUDED in prices */}
            <div className="p-4 border-t space-y-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal (excl. VAT)</span>
                  <span>KES {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>VAT (16% incl.)</span>
                  <span>KES {tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>TOTAL</span>
                  <span>KES {total.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Method - Modern Card Style */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'mpesa', 'card'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`flex flex-col items-center justify-center p-3 rounded-[1rem] border-2 transition-all ${
                        paymentMethod === method 
                          ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF]' 
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl mb-1">
                        {method === 'cash' ? '💵' : method === 'mpesa' ? '📱' : '💳'}
                      </span>
                      <span className="text-xs font-semibold">
                        {method === 'mpesa' ? 'M-Pesa' : method.charAt(0).toUpperCase() + method.slice(1)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons - Modern Style */}
              <div className="space-y-2">
                <button
                  onClick={handleGenerateReceipt}
                  disabled={cart.length === 0 || isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-[1rem] bg-[#34C759] hover:bg-[#2DB84D] text-white font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/30"
                >
                  <Printer className="h-5 w-5" />
                  {isSubmitting ? 'Processing...' : '🖨️ Generate Receipt'}
                </button>
                
                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="w-full py-3 px-6 rounded-[1rem] bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </IOSCard>
        </div>

        {/* Receipt Modal */}
        {showReceipt && lastOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:bg-[#FFFFFF]">
            <IOSCard className="w-96 max-h-[90vh] overflow-y-auto bg-[#FFFFFF] print:shadow-none print:border-none">
              <div className="p-6" id="receipt-content">
                {/* Receipt Header */}
                <div className="text-center mb-4">
                  <div className="w-16 h-16 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-gray-600" />
                  </div>
                  <h2 className="text-xl font-bold tracking-wide">FAMOUS GATE HOTEL</h2>
                  <p className="text-sm text-gray-500">{user?.branch_name || 'Restaurant'}</p>
                  <p className="text-xs text-gray-400">Kericho, Kenya</p>
                  <p className="text-xs text-gray-400">Tel: +254 700 000 000</p>
                </div>
                
                {/* Receipt Type */}
                <div className="text-center py-2 bg-gray-100 rounded mb-4">
                  <p className="font-bold text-sm">CASH RECEIPT</p>
                </div>
                
                {/* Receipt Info */}
                <div className="border-t border-dashed pt-3 mb-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Receipt #:</span><span className="font-medium">{lastOrder.receipt_number || lastOrder.order_number}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Date:</span><span>{new Date(lastOrder.created_at).toLocaleString()}</span></div>
                  {lastOrder.order_type === 'dine_in' && <div className="flex justify-between"><span className="text-gray-500">Table:</span><span>{lastOrder.table_number}</span></div>}
                  {lastOrder.order_type === 'room_service' && <div className="flex justify-between"><span className="text-gray-500">Room:</span><span>{lastOrder.room_number}</span></div>}
                  {lastOrder.customer_name && <div className="flex justify-between"><span className="text-gray-500">Customer:</span><span>{lastOrder.customer_name}</span></div>}
                  <div className="flex justify-between"><span className="text-gray-500">Cashier:</span><span>{user?.firstName || 'Staff'}</span></div>
                </div>
                
                {/* Items Header */}
                <div className="border-t border-dashed pt-3">
                  <div className="flex justify-between text-xs font-bold text-gray-600 mb-2">
                    <span>DESCRIPTION</span>
                    <span>PRICE</span>
                  </div>
                  
                  {/* Items */}
                  <div className="space-y-1 mb-3">
                    {lastOrder.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name || item.item_name || 'Item'}</span>
                        <span>{(item.unit_price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Totals - VAT is INCLUDED in prices */}
                <div className="border-t border-dashed pt-3 space-y-1">
                  <div className="flex justify-between text-sm"><span>SUBTOTAL</span><span>KES {lastOrder.subtotal?.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span>TAX (16% incl.)</span><span>KES {lastOrder.tax?.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-double"><span>TOTAL:</span><span>KES {lastOrder.total?.toLocaleString()}</span></div>
                </div>
                
                {/* Payment Info */}
                <div className="border-t border-dashed pt-3 mt-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Payment:</span><span className="font-medium">{lastOrder.payment_method?.toUpperCase()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Paid:</span><span>KES {lastOrder.total?.toLocaleString()}</span></div>
                  {lastOrder.change_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">Change:</span><span>KES {lastOrder.change_amount?.toLocaleString()}</span></div>}
                </div>
                
                {/* Footer */}
                <div className="border-t border-dashed pt-4 mt-4 text-center">
                  <p className="font-bold text-lg">THANK YOU!</p>
                  <p className="text-xs text-gray-500">Please come again</p>
                  <p className="text-xs text-gray-400 mt-1">info@famousgate.co.ke</p>
                </div>
                
                {/* Action Buttons - Hidden on print */}
                <div className="mt-6 space-y-2 print:hidden">
                  {/* Instant Print to Thermal Printer */}
                  <IOSButton 
                    onClick={async () => {
                      try {
                        toast.loading('Printing receipt...', { id: 'print' });
                        const receiptData = {
                          receipt_type: 'sale',
                          receipt_number: lastOrder.receipt_number || lastOrder.order_number,
                          date: lastOrder.created_at,
                          table_number: lastOrder.table_number,
                          room_number: lastOrder.room_number,
                          customer_name: lastOrder.customer_name,
                          cashier_name: user?.firstName,
                          items: lastOrder.items?.map((item: any) => ({
                            name: item.name || item.item_name,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            total: item.unit_price * item.quantity
                          })),
                          subtotal: lastOrder.subtotal,
                          tax_amount: lastOrder.tax,
                          total_amount: lastOrder.total,
                          payment_method: lastOrder.payment_method,
                          amount_paid: lastOrder.total,
                          change_amount: lastOrder.change_amount || 0
                        };
                        // Call Python microservice to print instantly
                        const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:5001'}/api/receipts/printer/print`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(receiptData)
                        });
                        const result = await response.json();
                        if (result.success) {
                          toast.success('Receipt printed to thermal printer!', { id: 'print' });
                        } else {
                          // Fallback to browser print
                          toast.dismiss('print');
                          window.print();
                          toast.success('Printed via browser');
                        }
                      } catch (error) {
                        toast.dismiss('print');
                        // Fallback to browser print
                        window.print();
                        toast.success('Printed via browser');
                      }
                    }} 
                    className="w-full bg-[#34C759] hover:bg-green-600"
                    leftIcon={<Printer />}
                  >
                    🖨️ Print Receipt Instantly
                  </IOSButton>
                  
                  <div className="flex gap-2">
                    <IOSButton 
                      variant="secondary" 
                      onClick={async () => {
                        try {
                          const receiptData = {
                            receipt_type: 'sale',
                            receipt_number: lastOrder.receipt_number || lastOrder.order_number,
                            date: lastOrder.created_at,
                            table_number: lastOrder.table_number,
                            room_number: lastOrder.room_number,
                            customer_name: lastOrder.customer_name,
                            cashier_name: user?.firstName,
                            items: lastOrder.items?.map((item: any) => ({
                              name: item.name || item.item_name,
                              quantity: item.quantity,
                              unit_price: item.unit_price,
                              total: item.unit_price * item.quantity
                            })),
                            subtotal: lastOrder.subtotal,
                            tax_amount: lastOrder.tax,
                            total_amount: lastOrder.total,
                            payment_method: lastOrder.payment_method,
                            amount_paid: lastOrder.total,
                            change_amount: lastOrder.change_amount || 0
                          };
                          const blob = await receiptsAPI.generatePDF(receiptData);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `receipt_${lastOrder.receipt_number || lastOrder.order_number}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success('Receipt downloaded!');
                        } catch (error) {
                          toast.error('Failed to download PDF');
                          console.error(error);
                        }
                      }} 
                      className="flex-1"
                      leftIcon={<Download />}
                    >
                      Download PDF
                    </IOSButton>
                    <IOSButton variant="secondary" onClick={() => window.print()} className="flex-1" leftIcon={<Printer />}>
                      Browser Print
                    </IOSButton>
                  </div>
                  <IOSButton onClick={() => setShowReceipt(false)} className="w-full" leftIcon={<Check />}>
                    Done
                  </IOSButton>
                </div>
              </div>
            </IOSCard>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
