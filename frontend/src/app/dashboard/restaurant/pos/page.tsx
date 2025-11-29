'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UtensilsCrossed, ShoppingCart, Search, Plus, Minus, Trash2,
  CreditCard, Banknote, Smartphone, X, Printer, FileText,
  Bed, Coffee, Pizza, CheckCircle, RefreshCw, Receipt, Edit3
} from 'lucide-react';
import { toast } from 'sonner';
import { restaurantAPI, roomsAPI, systemAPI } from '@/lib/api';

const defaultMenuItems = [
  { id: '1', name: 'Full English Breakfast', price: 850, category: 'breakfast', available: true },
  { id: '2', name: 'Pancakes Stack', price: 550, category: 'breakfast', available: true },
  { id: '3', name: 'Eggs Benedict', price: 750, category: 'breakfast', available: true },
  { id: '4', name: 'Grilled Chicken Salad', price: 750, category: 'lunch', available: true },
  { id: '5', name: 'Club Sandwich', price: 650, category: 'lunch', available: true },
  { id: '6', name: 'Beef Burger', price: 850, category: 'lunch', available: true },
  { id: '7', name: 'Fish & Chips', price: 950, category: 'lunch', available: true },
  { id: '8', name: 'Grilled Tilapia', price: 1200, category: 'dinner', available: true },
  { id: '9', name: 'Beef Steak', price: 1800, category: 'dinner', available: true },
  { id: '10', name: 'Chicken Curry', price: 950, category: 'dinner', available: true },
  { id: '11', name: 'Lamb Chops', price: 1650, category: 'dinner', available: true },
  { id: '12', name: 'Chicken Wings', price: 550, category: 'appetizers', available: true },
  { id: '13', name: 'Spring Rolls', price: 350, category: 'appetizers', available: true },
  { id: '14', name: 'Samosas', price: 250, category: 'appetizers', available: true },
  { id: '15', name: 'Tomato Soup', price: 350, category: 'soups', available: true },
  { id: '16', name: 'Chocolate Cake', price: 450, category: 'desserts', available: true },
  { id: '17', name: 'Ice Cream', price: 300, category: 'desserts', available: true },
  { id: '18', name: 'Fresh Juice', price: 250, category: 'beverages', available: true },
  { id: '19', name: 'Soft Drinks', price: 150, category: 'beverages', available: true },
  { id: '20', name: 'Tea/Coffee', price: 200, category: 'beverages', available: true },
  { id: '21', name: 'Beer', price: 350, category: 'beverages', available: true },
  { id: '22', name: 'Wine (Glass)', price: 500, category: 'beverages', available: true },
];

const categories = ['all', 'breakfast', 'lunch', 'dinner', 'appetizers', 'soups', 'desserts', 'beverages'];

interface CartItem { id: string; name: string; price: number; quantity: number; }

// Workflow: Generate Bill → Customer Reviews → Payment → Confirmed Receipt
type OrderStage = 'cart' | 'bill' | 'payment' | 'confirmed';

export default function RestaurantPOSPage() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orderStage, setOrderStage] = useState<OrderStage>('cart');
  const [orderType, setOrderType] = useState<'dine-in' | 'room-service' | 'takeaway'>('dine-in');
  const [tableNumber, setTableNumber] = useState('1');
  const [roomNumber, setRoomNumber] = useState('');
  const [guestName, setGuestName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [currentBill, setCurrentBill] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  
  // Multi-branch state
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(user?.branch_id || null);
  const canSwitchBranch = !user?.branch_id || user.role === UserRole.SUPER_ADMIN || user.role === UserRole.GENERAL_MANAGER;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch branches if user can switch
        if (canSwitchBranch) {
          const branchesRes = await systemAPI.getBranches().catch(() => ({ data: [] }));
          const branchList = branchesRes.data || [];
          setBranches(branchList);
          
          // Default to first branch if none selected and list exists
          if (!selectedBranchId && branchList.length > 0) {
            setSelectedBranchId(branchList[0].id);
          }
        }

        const [menuRes, catRes, roomsRes] = await Promise.all([
          restaurantAPI.getMenuItems(undefined, selectedBranchId || undefined).catch(() => ({ data: defaultMenuItems })),
          restaurantAPI.getCategories().catch(() => ({ data: [] })),
          roomsAPI.getRooms(selectedBranchId || undefined).catch(() => ({ data: [] }))
        ]);

        setMenuItems(menuRes.data || defaultMenuItems);
        
        const catData = catRes.data || [];
        console.log('Fetched categories:', catData);
        
        if (Array.isArray(catData) && catData.length > 0) {
          const mappedCats = catData
            .filter((c: any) => c && typeof c === 'object' && c.name)
            .map((c: any) => String(c.name).toLowerCase());
          
          setCategories(['all', ...Array.from(new Set(mappedCats))]);
        } else {
          setCategories(['all', 'breakfast', 'lunch', 'dinner', 'appetizers', 'soups', 'desserts', 'beverages']);
        }

        const roomList = roomsRes.rooms || roomsRes.data || [];
        setRooms(roomList.filter((r: any) => r.status === 'occupied'));
      } catch (error) {
        console.error('Error fetching data:', error);
        setMenuItems(defaultMenuItems);
      }
    };
    fetchData();
  }, [canSwitchBranch, selectedBranchId]);

  // Handle branch change
  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBranchId = parseInt(e.target.value);
    setSelectedBranchId(newBranchId);
    setCart([]); // Clear cart on branch switch
    setOrderStage('cart');
    toast.info('Switched branch - Cart cleared');
  };

  const filteredItems = menuItems.filter(item => {
    const itemCat = item.category?.name?.toLowerCase() || item.category_id || item.category;
    const matchesCat = selectedCategory === 'all' || itemCat === selectedCategory || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch && (item.available ?? item.is_available ?? true);
  });

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));
  const clearCart = () => { setCart([]); setOrderStage('cart'); setCurrentBill(null); };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const serviceCharge = Math.round(subtotal * 0.1);
  const total = subtotal + serviceCharge;
  const change = cashReceived ? Math.max(0, parseInt(cashReceived) - total) : 0;

  // Step 1: Generate Bill for customer to review
  const generateBill = () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    const billNum = `BILL-${Date.now().toString().slice(-6)}`;
    const bill = {
      bill_number: billNum,
      items: [...cart],
      subtotal,
      service_charge: serviceCharge,
      total,
      type: orderType,
      table_number: tableNumber,
      room_number: roomNumber,
      guest_name: guestName,
      created_at: new Date().toISOString(),
      status: 'pending_review'
    };
    setCurrentBill(bill);
    setOrderStage('bill');
    toast.success('Bill generated - Give to customer for review');
  };

  // Step 2: Customer reviewed, proceed to payment
  const proceedToPayment = () => {
    setOrderStage('payment');
  };

  // Step 3: Process payment and confirm order
  const processPayment = async () => {
    if (paymentMethod === 'cash' && parseInt(cashReceived || '0') < total) {
      toast.error('Insufficient cash received'); return;
    }
    setIsLoading(true);
    
    const orderNum = `ORD-${Date.now().toString().slice(-6)}`;
    const confirmedOrder = {
      ...currentBill,
      order_number: orderNum,
      bill_number: currentBill.bill_number,
      payment_method: paymentMethod,
      cash_received: paymentMethod === 'cash' ? parseInt(cashReceived) : null,
      change: paymentMethod === 'cash' ? change : null,
      status: 'paid',
      paid_at: new Date().toISOString()
    };
    
    setCurrentBill(confirmedOrder);
    
    try {
      await restaurantAPI.createOrder({
        orderType,
        tableNumber: tableNumber,
        roomNumber: roomNumber,
        guestName, // Backend might not use this but keeping it for potential future use or different controller version
        items: cart.map(i => ({ 
          menuItemId: i.id, 
          name: i.name, 
          quantity: i.quantity, 
          unitPrice: i.price, 
          total: i.price * i.quantity 
        })),
        subtotal,
        serviceCharge,
        total,
        paymentMethod,
        status: 'confirmed',
        branchId: selectedBranchId
      });
      
      toast.success(`Payment received! Order ${orderNum} confirmed`);
      setOrderStage('confirmed');
      setCart([]);
      setCashReceived('');
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Go back to edit bill
  const editBill = () => {
    setOrderStage('cart');
    toast.info('You can now edit the order');
  };

  // Start new order
  const newOrder = () => {
    setCart([]);
    setCurrentBill(null);
    setOrderStage('cart');
    setCashReceived('');
    setGuestName('');
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="flex h-[calc(100vh-120px)] gap-4">
          {/* Menu Panel */}
          <div className="flex-1 flex flex-col bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b space-y-3">
              <div className="flex justify-between items-center">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input type="text" placeholder="Search menu..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
                </div>
                {canSwitchBranch && branches.length > 0 && (
                  <div className="ml-4">
                    <select 
                      value={selectedBranchId || ''} 
                      onChange={handleBranchChange}
                      className="px-3 py-2 border rounded-lg bg-gray-50 text-sm font-medium"
                    >
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredItems.map(item => (
                  <button key={item.id} onClick={() => addToCart(item)} className="bg-gray-50 hover:bg-indigo-50 border hover:border-indigo-300 rounded-lg p-3 text-left">
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-indigo-600 font-bold mt-2">KES {item.price.toLocaleString()}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Panel */}
          <div className="w-96 flex flex-col bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex gap-2 mb-3">
                {(['dine-in', 'room-service', 'takeaway'] as const).map(t => (
                  <button key={t} onClick={() => setOrderType(t)} className={`flex-1 py-2 rounded-lg text-sm font-medium ${orderType === t ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>
                    {t === 'dine-in' ? 'Dine In' : t === 'room-service' ? 'Room' : 'Takeaway'}
                  </button>
                ))}
              </div>
              {orderType === 'dine-in' && (
                <select value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {[...Array(20)].map((_, i) => <option key={i+1} value={i+1}>Table {i+1}</option>)}
                </select>
              )}
              {orderType === 'room-service' && (
                <select value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select Room</option>
                  {rooms.map(r => <option key={r.id} value={r.room_number}>Room {r.room_number}</option>)}
                </select>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><ShoppingCart className="h-12 w-12 mx-auto mb-3" /><p>Cart empty</p></div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1"><div className="font-medium text-sm">{item.name}</div><div className="text-indigo-600 text-sm">KES {item.price}</div></div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.id, -1)} className="p-1 rounded bg-white border"><Minus className="h-4 w-4" /></button>
                        <span className="w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="p-1 rounded bg-white border"><Plus className="h-4 w-4" /></button>
                        <button onClick={() => removeItem(item.id)} className="p-1 text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <div className="space-y-1 mb-4 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>KES {subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-gray-500"><span>Service (10%)</span><span>KES {serviceCharge.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span className="text-indigo-600">KES {total.toLocaleString()}</span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={clearCart} disabled={!cart.length} className="px-4 py-3 border rounded-lg disabled:opacity-50">Clear</button>
                <button onClick={generateBill} disabled={!cart.length} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5" /> Generate Bill
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 1: Bill Preview Modal - Give to customer to review */}
        {orderStage === 'bill' && currentBill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-xl font-bold">Bill Preview</h2>
                </div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Pending Review</span>
              </div>

              <div className="font-mono text-sm border rounded-lg p-4 bg-gray-50">
                <div className="text-center border-b border-dashed pb-3 mb-3">
                  <div className="text-lg font-bold">Famous Gate Hotel</div>
                  <div className="text-xs text-gray-500">Tel: +254 700 123 456</div>
                  <div className="mt-2 font-bold text-indigo-600">*** BILL ***</div>
                  <div className="text-xs">{currentBill.bill_number}</div>
                  <div className="text-xs">{new Date(currentBill.created_at).toLocaleString()}</div>
                  <div className="text-xs mt-1">
                    {currentBill.type === 'dine-in' && `Table ${currentBill.table_number}`}
                    {currentBill.type === 'room-service' && `Room ${currentBill.room_number}`}
                    {currentBill.type === 'takeaway' && 'Takeaway'}
                  </div>
                </div>
                <div className="border-b border-dashed pb-3 mb-3">
                  {currentBill.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between py-1">
                      <span>{item.quantity}x {item.name}</span>
                      <span>KES {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>KES {currentBill.subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Service (10%)</span><span>KES {currentBill.service_charge.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2"><span>TOTAL</span><span>KES {currentBill.total.toLocaleString()}</span></div>
                </div>
                <div className="text-center mt-3 text-xs text-gray-500 italic">Please review and confirm your order</div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <strong>Step 1:</strong> Print and give this bill to the customer for review. They can dispute any mistakes before payment.
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={editBill} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-1 hover:bg-gray-50">
                  <Edit3 className="h-4 w-4" /> Edit Order
                </button>
                <button onClick={() => window.print()} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-1 hover:bg-gray-50">
                  <Printer className="h-4 w-4" /> Print Bill
                </button>
              </div>
              <button onClick={proceedToPayment} className="w-full mt-2 py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-green-700">
                <CheckCircle className="h-5 w-5" /> Customer Approved → Payment
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Payment Modal - After customer approves */}
        {orderStage === 'payment' && currentBill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-green-600" />
                  <h2 className="text-xl font-bold">Process Payment</h2>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Bill Approved</span>
              </div>

              <div className="text-center p-4 bg-indigo-50 rounded-xl mb-4">
                <div className="text-sm text-gray-500">Bill: {currentBill.bill_number}</div>
                <div className="text-3xl font-bold text-indigo-600">KES {currentBill.total.toLocaleString()}</div>
              </div>

              <div className="text-sm font-medium mb-2">Payment Method</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['cash', 'card', 'mpesa'] as const).map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)} className={`p-3 rounded-lg border-2 transition-all ${paymentMethod === m ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    {m === 'cash' ? <Banknote className="h-5 w-5 mx-auto" /> : m === 'card' ? <CreditCard className="h-5 w-5 mx-auto" /> : <Smartphone className="h-5 w-5 mx-auto" />}
                    <div className="text-xs mt-1 capitalize">{m === 'mpesa' ? 'M-Pesa' : m}</div>
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' && (
                <div className="mb-4">
                  <label className="text-sm font-medium mb-1 block">Cash Received</label>
                  <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder="Enter amount" className="w-full px-4 py-3 border rounded-lg text-lg" />
                  {parseInt(cashReceived || '0') >= currentBill.total && (
                    <div className="mt-2 p-3 bg-green-50 rounded-lg text-green-700 flex justify-between">
                      <span>Change to give:</span>
                      <span className="font-bold">KES {change.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setOrderStage('bill')} className="px-4 py-3 border rounded-lg hover:bg-gray-50">Back</button>
                <button onClick={processPayment} disabled={isLoading} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50">
                  {isLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />} 
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Confirmed Receipt - After payment */}
        {orderStage === 'confirmed' && currentBill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <h2 className="text-xl font-bold text-green-600">Payment Complete!</h2>
              </div>

              <div className="font-mono text-sm border rounded-lg p-4 bg-gray-50">
                <div className="text-center border-b border-dashed pb-3 mb-3">
                  <div className="text-lg font-bold">Famous Gate Hotel</div>
                  <div className="text-xs text-gray-500">Tel: +254 700 123 456</div>
                  <div className="mt-2 font-bold text-green-600">*** PAID RECEIPT ***</div>
                  <div className="text-xs">Order: {currentBill.order_number}</div>
                  <div className="text-xs">Bill: {currentBill.bill_number}</div>
                  <div className="text-xs">{new Date(currentBill.paid_at).toLocaleString()}</div>
                  <div className="text-xs mt-1">
                    {currentBill.type === 'dine-in' && `Table ${currentBill.table_number}`}
                    {currentBill.type === 'room-service' && `Room ${currentBill.room_number}`}
                    {currentBill.type === 'takeaway' && 'Takeaway'}
                  </div>
                </div>
                <div className="border-b border-dashed pb-3 mb-3">
                  {currentBill.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between py-1">
                      <span>{item.quantity}x {item.name}</span>
                      <span>KES {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>KES {currentBill.subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Service</span><span>KES {currentBill.service_charge.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2"><span>TOTAL PAID</span><span>KES {currentBill.total.toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs text-gray-500 pt-1">
                    <span>Payment Method</span>
                    <span className="uppercase font-medium">{currentBill.payment_method === 'mpesa' ? 'M-Pesa' : currentBill.payment_method}</span>
                  </div>
                  {currentBill.payment_method === 'cash' && currentBill.change > 0 && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Change Given</span>
                      <span>KES {currentBill.change.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="text-center mt-3 pt-3 border-t border-dashed text-xs text-gray-500">
                  Thank you for dining with us!<br/>
                  Please come again
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => window.print()} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-1 hover:bg-gray-50">
                  <Printer className="h-4 w-4" /> Print Receipt
                </button>
                <button onClick={newOrder} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-1 hover:bg-indigo-700">
                  <Plus className="h-4 w-4" /> New Order
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
