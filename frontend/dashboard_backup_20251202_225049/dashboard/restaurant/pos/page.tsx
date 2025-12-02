'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
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

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.16);
  const total = subtotal + tax;

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
          cashier_name: user?.first_name || 'Staff',
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search menu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredItems.map((item) => (
                    <IOSCard
                      key={item.id}
                      className="p-3 cursor-pointer hover:shadow-lg transition active:scale-95"
                      onClick={() => addToCart(item)}
                    >
                      <div className="h-16 bg-gradient-to-br from-orange-100 to-yellow-100 rounded-ios-lg mb-2 flex items-center justify-center">
                        <Soup className="h-8 w-8 text-orange-500" />
                      </div>
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-blue-600 font-bold">KES {item.price?.toLocaleString()}</p>
                    </IOSCard>
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
              {/* Order Type */}
              <div className="flex gap-2 mt-3">
                {(['dine_in', 'takeaway', 'room_service'] as const).map((type) => (
                  <IOSButton
                    key={type}
                    size="sm"
                    variant={orderType === type ? 'primary' : 'secondary'}
                    onClick={() => setOrderType(type)}
                    className="flex-1"
                  >
                    {type === 'dine_in' ? 'Dine In' : type === 'takeaway' ? 'Takeaway' : 'Room'}
                  </IOSButton>
                ))}
              </div>
              {/* Table/Room Number */}
              <div className="mt-3">
                {orderType === 'dine_in' && (
                  <Input
                    placeholder="Table Number"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                  />
                )}
                {orderType === 'room_service' && (
                  <Input
                    placeholder="Room Number"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                  />
                )}
                {orderType === 'takeaway' && (
                  <Input
                    placeholder="Customer Name (optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
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
                        <p className="text-blue-600 text-sm">KES {(item.price * item.quantity).toLocaleString()}</p>
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

            {/* Totals & Actions */}
            <div className="p-4 border-t space-y-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>KES {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (16%)</span>
                  <span>KES {tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>KES {total.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex gap-2 mb-3">
                {(['cash', 'mpesa', 'card'] as const).map((method) => (
                  <IOSButton
                    key={method}
                    size="sm"
                    variant={paymentMethod === method ? 'primary' : 'secondary'}
                    onClick={() => setPaymentMethod(method)}
                    className="flex-1"
                  >
                    {method === 'cash' ? <Banknote className="h-3 w-3 mr-1" /> : method === 'mpesa' ? '📱' : <CreditCard className="h-3 w-3 mr-1" />}
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </IOSButton>
                ))}
              </div>

              <div className="flex gap-2">
                <IOSButton variant="secondary" onClick={clearCart} className="flex-1" disabled={cart.length === 0}>
                  Clear
                </IOSButton>
                <IOSButton
                  onClick={handleGenerateReceipt}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={cart.length === 0 || isSubmitting}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Processing...' : 'Generate Receipt'}
                </IOSButton>
              </div>
            </div>
          </IOSCard>
        </div>

        {/* Receipt Modal */}
        {showReceipt && lastOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:bg-white">
            <IOSCard className="w-96 max-h-[90vh] overflow-y-auto bg-white print:shadow-none print:border-none">
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
                  <div className="flex justify-between"><span className="text-gray-500">Cashier:</span><span>{user?.first_name || 'Staff'}</span></div>
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
                
                {/* Totals */}
                <div className="border-t border-dashed pt-3 space-y-1">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><span>KES {lastOrder.subtotal?.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span>Tax (16%)</span><span>KES {lastOrder.tax?.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-double"><span>Total</span><span>KES {lastOrder.total?.toLocaleString()}</span></div>
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
                            cashier_name: user?.first_name,
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
                    >
                      <Download className="h-4 w-4 mr-2" /> Download PDF
                    </IOSButton>
                    <IOSButton variant="secondary" onClick={() => window.print()} className="flex-1">
                      <Printer className="h-4 w-4 mr-2" /> Print
                    </IOSButton>
                  </div>
                  <IOSButton onClick={() => setShowReceipt(false)} className="w-full">
                    <Check className="h-4 w-4 mr-2" /> Done
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
