'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  Wine, Beer, GlassWater, ShoppingCart, Search, Plus, Minus, Trash2,
  CreditCard, Banknote, Smartphone, X, Printer, FileText, Users,
  CheckCircle, RefreshCw, Edit3
} from 'lucide-react';
import { toast } from 'sonner';
import { barAPI, roomsAPI } from '@/lib/api';

// Comprehensive drinks menu with Kenyan prices
const defaultDrinks = [
  // Beers - Local
  { id: '1', name: 'Tusker Lager', price: 300, category: 'beers', subcategory: 'local', available: true },
  { id: '2', name: 'Tusker Malt', price: 350, category: 'beers', subcategory: 'local', available: true },
  { id: '3', name: 'White Cap Lager', price: 300, category: 'beers', subcategory: 'local', available: true },
  { id: '4', name: 'Pilsner Lager', price: 300, category: 'beers', subcategory: 'local', available: true },
  { id: '5', name: 'Guinness', price: 400, category: 'beers', subcategory: 'local', available: true },
  { id: '6', name: 'Senator Keg (500ml)', price: 200, category: 'beers', subcategory: 'local', available: true },
  // Beers - Imported
  { id: '7', name: 'Heineken', price: 450, category: 'beers', subcategory: 'imported', available: true },
  { id: '8', name: 'Corona', price: 500, category: 'beers', subcategory: 'imported', available: true },
  { id: '9', name: 'Budweiser', price: 450, category: 'beers', subcategory: 'imported', available: true },
  
  // Whisky
  { id: '10', name: 'Jameson (Shot)', price: 400, category: 'whisky', available: true },
  { id: '11', name: 'Jameson (Double)', price: 750, category: 'whisky', available: true },
  { id: '12', name: 'Jack Daniels (Shot)', price: 450, category: 'whisky', available: true },
  { id: '13', name: 'Jack Daniels (Double)', price: 850, category: 'whisky', available: true },
  { id: '14', name: 'Johnnie Walker Red (Shot)', price: 350, category: 'whisky', available: true },
  { id: '15', name: 'Johnnie Walker Black (Shot)', price: 550, category: 'whisky', available: true },
  { id: '16', name: 'Glenfiddich 12yr (Shot)', price: 800, category: 'whisky', available: true },
  { id: '17', name: 'Chivas Regal (Shot)', price: 600, category: 'whisky', available: true },
  
  // Vodka
  { id: '18', name: 'Smirnoff (Shot)', price: 300, category: 'vodka', available: true },
  { id: '19', name: 'Smirnoff (Double)', price: 550, category: 'vodka', available: true },
  { id: '20', name: 'Absolut (Shot)', price: 400, category: 'vodka', available: true },
  { id: '21', name: 'Grey Goose (Shot)', price: 700, category: 'vodka', available: true },
  { id: '22', name: 'Ciroc (Shot)', price: 650, category: 'vodka', available: true },
  
  // Gin
  { id: '23', name: 'Gordons Gin (Shot)', price: 300, category: 'gin', available: true },
  { id: '24', name: 'Tanqueray (Shot)', price: 450, category: 'gin', available: true },
  { id: '25', name: 'Bombay Sapphire (Shot)', price: 500, category: 'gin', available: true },
  { id: '26', name: 'Hendricks (Shot)', price: 650, category: 'gin', available: true },
  
  // Rum
  { id: '27', name: 'Captain Morgan (Shot)', price: 350, category: 'rum', available: true },
  { id: '28', name: 'Bacardi White (Shot)', price: 350, category: 'rum', available: true },
  { id: '29', name: 'Bacardi Gold (Shot)', price: 400, category: 'rum', available: true },
  { id: '30', name: 'Malibu (Shot)', price: 400, category: 'rum', available: true },
  
  // Brandy & Cognac
  { id: '31', name: 'Viceroy (Shot)', price: 250, category: 'brandy', available: true },
  { id: '32', name: 'KWV 5yr (Shot)', price: 350, category: 'brandy', available: true },
  { id: '33', name: 'Hennessy VS (Shot)', price: 700, category: 'brandy', available: true },
  { id: '34', name: 'Remy Martin VSOP (Shot)', price: 900, category: 'brandy', available: true },
  
  // Wines
  { id: '35', name: 'House Red Wine (Glass)', price: 500, category: 'wines', available: true },
  { id: '36', name: 'House White Wine (Glass)', price: 500, category: 'wines', available: true },
  { id: '37', name: 'House Rose (Glass)', price: 500, category: 'wines', available: true },
  { id: '38', name: 'Red Wine (Bottle)', price: 2500, category: 'wines', available: true },
  { id: '39', name: 'White Wine (Bottle)', price: 2500, category: 'wines', available: true },
  { id: '40', name: 'Sparkling Wine (Bottle)', price: 3500, category: 'wines', available: true },
  
  // Cocktails - Classic
  { id: '41', name: 'Mojito', price: 650, category: 'cocktails', available: true },
  { id: '42', name: 'Margarita', price: 700, category: 'cocktails', available: true },
  { id: '43', name: 'Piña Colada', price: 700, category: 'cocktails', available: true },
  { id: '44', name: 'Long Island Iced Tea', price: 850, category: 'cocktails', available: true },
  { id: '45', name: 'Cosmopolitan', price: 700, category: 'cocktails', available: true },
  { id: '46', name: 'Mai Tai', price: 750, category: 'cocktails', available: true },
  { id: '47', name: 'Daiquiri', price: 650, category: 'cocktails', available: true },
  { id: '48', name: 'Sex on the Beach', price: 700, category: 'cocktails', available: true },
  { id: '49', name: 'Whisky Sour', price: 600, category: 'cocktails', available: true },
  { id: '50', name: 'Old Fashioned', price: 750, category: 'cocktails', available: true },
  
  // Mixers & Soft Drinks
  { id: '51', name: 'Coca Cola', price: 150, category: 'soft-drinks', available: true },
  { id: '52', name: 'Fanta Orange', price: 150, category: 'soft-drinks', available: true },
  { id: '53', name: 'Sprite', price: 150, category: 'soft-drinks', available: true },
  { id: '54', name: 'Tonic Water', price: 200, category: 'soft-drinks', available: true },
  { id: '55', name: 'Soda Water', price: 150, category: 'soft-drinks', available: true },
  { id: '56', name: 'Ginger Ale', price: 200, category: 'soft-drinks', available: true },
  { id: '57', name: 'Red Bull', price: 400, category: 'soft-drinks', available: true },
  { id: '58', name: 'Mineral Water', price: 100, category: 'soft-drinks', available: true },
  
  // Shooters
  { id: '59', name: 'Tequila Shot', price: 400, category: 'shooters', available: true },
  { id: '60', name: 'Jagermeister Shot', price: 450, category: 'shooters', available: true },
  { id: '61', name: 'B-52', price: 500, category: 'shooters', available: true },
  { id: '62', name: 'Sambuca Shot', price: 400, category: 'shooters', available: true },
];

const categories = ['all', 'beers', 'whisky', 'vodka', 'gin', 'rum', 'brandy', 'wines', 'cocktails', 'shooters', 'soft-drinks'];

interface CartItem { id: string; name: string; price: number; quantity: number; }
type OrderStage = 'cart' | 'bill' | 'payment' | 'confirmed';

export default function BarPOSPage() {
  const { user } = useAuth();
  const [drinks] = useState(defaultDrinks);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orderStage, setOrderStage] = useState<OrderStage>('cart');
  const [orderType, setOrderType] = useState<'bar' | 'tab' | 'room-service'>('bar');
  const [seatNumber, setSeatNumber] = useState('');
  const [tabName, setTabName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [currentBill, setCurrentBill] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    roomsAPI.getRooms().then(res => {
      const list = res.rooms || res.data || [];
      setRooms(list.filter((r: any) => r.status === 'occupied'));
    }).catch(() => {});
  }, []);

  const filteredDrinks = drinks.filter(drink => {
    const matchesCat = selectedCategory === 'all' || drink.category === selectedCategory;
    const matchesSearch = drink.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch && drink.available;
  });

  const addToCart = (drink: typeof drinks[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === drink.id);
      if (existing) return prev.map(c => c.id === drink.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { id: drink.id, name: drink.name, price: drink.price, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));
  const clearCart = () => { setCart([]); setOrderStage('cart'); setCurrentBill(null); };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal; // No service charge for bar
  const change = cashReceived ? Math.max(0, parseInt(cashReceived) - total) : 0;

  const generateBill = () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    const billNum = `BAR-${Date.now().toString().slice(-6)}`;
    const bill = {
      bill_number: billNum,
      items: [...cart],
      subtotal,
      total,
      type: orderType,
      seat_number: seatNumber,
      tab_name: tabName,
      room_number: roomNumber,
      created_at: new Date().toISOString(),
      status: 'pending_review'
    };
    setCurrentBill(bill);
    setOrderStage('bill');
    toast.success('Bill generated');
  };

  const proceedToPayment = () => setOrderStage('payment');

  const processPayment = async () => {
    if (paymentMethod === 'cash' && parseInt(cashReceived || '0') < total) {
      toast.error('Insufficient cash'); return;
    }
    setIsLoading(true);
    
    const orderNum = `BAR-${Date.now().toString().slice(-6)}`;
    const confirmedOrder = {
      ...currentBill,
      order_number: orderNum,
      payment_method: paymentMethod,
      cash_received: paymentMethod === 'cash' ? parseInt(cashReceived) : null,
      change: paymentMethod === 'cash' ? change : null,
      status: 'paid',
      paid_at: new Date().toISOString()
    };
    
    setCurrentBill(confirmedOrder);
    
    try {
      await barAPI.createOrder({
        type: orderType,
        seat_number: seatNumber,
        tab_name: tabName,
        room_number: roomNumber,
        items: cart.map(i => ({ drink_id: i.id, name: i.name, quantity: i.quantity, unit_price: i.price, total: i.price * i.quantity })),
        subtotal,
        total,
        payment_method: paymentMethod,
        status: 'confirmed'
      }).catch(() => {});
    } catch {}
    
    toast.success(`Order ${orderNum} confirmed!`);
    setOrderStage('confirmed');
    setCart([]);
    setCashReceived('');
    setIsLoading(false);
  };

  const editBill = () => { setOrderStage('cart'); toast.info('Edit the order'); };
  const newOrder = () => { setCart([]); setCurrentBill(null); setOrderStage('cart'); setCashReceived(''); setTabName(''); };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="flex h-[calc(100vh-120px)] gap-4">
          {/* Drinks Menu Panel */}
          <div className="flex-1 flex flex-col bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center gap-2">
                <Wine className="h-6 w-6 text-purple-600" />
                <h1 className="text-xl font-bold">Bar POS</h1>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="text" placeholder="Search drinks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap capitalize ${selectedCategory === cat ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    {cat.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredDrinks.map(drink => (
                  <button key={drink.id} onClick={() => addToCart(drink)} className="bg-gray-50 hover:bg-purple-50 border hover:border-purple-300 rounded-lg p-3 text-left transition-colors">
                    <div className="font-medium text-sm">{drink.name}</div>
                    <div className="text-xs text-gray-500 capitalize mt-1">{drink.category}</div>
                    <div className="text-purple-600 font-bold mt-2">KES {drink.price.toLocaleString()}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Panel */}
          <div className="w-96 flex flex-col bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex gap-2 mb-3">
                {(['bar', 'tab', 'room-service'] as const).map(t => (
                  <button key={t} onClick={() => setOrderType(t)} className={`flex-1 py-2 rounded-lg text-sm font-medium ${orderType === t ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}>
                    {t === 'bar' ? 'Bar' : t === 'tab' ? 'Tab' : 'Room'}
                  </button>
                ))}
              </div>
              {orderType === 'bar' && (
                <input type="text" placeholder="Seat/Stool Number (optional)" value={seatNumber} onChange={(e) => setSeatNumber(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
              )}
              {orderType === 'tab' && (
                <input type="text" placeholder="Customer Name for Tab" value={tabName} onChange={(e) => setTabName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
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
                      <div className="flex-1"><div className="font-medium text-sm">{item.name}</div><div className="text-purple-600 text-sm">KES {item.price}</div></div>
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
              <div className="flex justify-between font-bold text-lg mb-4"><span>Total</span><span className="text-purple-600">KES {total.toLocaleString()}</span></div>
              <div className="flex gap-2">
                <button onClick={clearCart} disabled={!cart.length} className="px-4 py-3 border rounded-lg disabled:opacity-50">Clear</button>
                <button onClick={generateBill} disabled={!cart.length} className="flex-1 py-3 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5" /> Generate Bill
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bill Preview Modal */}
        {orderStage === 'bill' && currentBill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-purple-600" /><h2 className="text-xl font-bold">Bar Bill</h2></div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Review</span>
              </div>
              <div className="font-mono text-sm border rounded-lg p-4 bg-gray-50">
                <div className="text-center border-b border-dashed pb-3 mb-3">
                  <div className="text-lg font-bold">Famous Gate Bar</div>
                  <div className="text-xs text-gray-500">{user?.branch_name}</div>
                  <div className="mt-2 font-bold text-purple-600">*** BAR BILL ***</div>
                  <div className="text-xs">{currentBill.bill_number}</div>
                  <div className="text-xs">{new Date(currentBill.created_at).toLocaleString()}</div>
                  {currentBill.tab_name && <div className="text-xs mt-1">Tab: {currentBill.tab_name}</div>}
                  {currentBill.seat_number && <div className="text-xs">Seat: {currentBill.seat_number}</div>}
                </div>
                <div className="border-b border-dashed pb-3 mb-3">
                  {currentBill.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between py-1"><span>{item.quantity}x {item.name}</span><span>KES {(item.price * item.quantity).toLocaleString()}</span></div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-lg"><span>TOTAL</span><span>KES {currentBill.total.toLocaleString()}</span></div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={editBill} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-1"><Edit3 className="h-4 w-4" /> Edit</button>
                <button onClick={() => window.print()} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-1"><Printer className="h-4 w-4" /> Print</button>
              </div>
              <button onClick={proceedToPayment} className="w-full mt-2 py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                <CheckCircle className="h-5 w-5" /> Proceed to Payment
              </button>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {orderStage === 'payment' && currentBill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Payment</h2>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Approved</span>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl mb-4">
                <div className="text-sm text-gray-500">{currentBill.bill_number}</div>
                <div className="text-3xl font-bold text-purple-600">KES {currentBill.total.toLocaleString()}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['cash', 'card', 'mpesa'] as const).map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)} className={`p-3 rounded-lg border-2 ${paymentMethod === m ? 'border-purple-600 bg-purple-50' : 'border-gray-200'}`}>
                    {m === 'cash' ? <Banknote className="h-5 w-5 mx-auto" /> : m === 'card' ? <CreditCard className="h-5 w-5 mx-auto" /> : <Smartphone className="h-5 w-5 mx-auto" />}
                    <div className="text-xs mt-1 capitalize">{m === 'mpesa' ? 'M-Pesa' : m}</div>
                  </button>
                ))}
              </div>
              {paymentMethod === 'cash' && (
                <div className="mb-4">
                  <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder="Cash received" className="w-full px-4 py-3 border rounded-lg" />
                  {parseInt(cashReceived || '0') >= currentBill.total && <div className="mt-2 p-2 bg-green-50 rounded text-green-700">Change: KES {change.toLocaleString()}</div>}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setOrderStage('bill')} className="px-4 py-3 border rounded-lg">Back</button>
                <button onClick={processPayment} disabled={isLoading} className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                  {isLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />} Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmed Receipt */}
        {orderStage === 'confirmed' && currentBill && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <h2 className="text-xl font-bold text-green-600">Payment Complete!</h2>
              </div>
              <div className="font-mono text-sm border rounded-lg p-4 bg-gray-50">
                <div className="text-center border-b border-dashed pb-3 mb-3">
                  <div className="text-lg font-bold">Famous Gate Bar</div>
                  <div className="mt-2 font-bold text-green-600">*** PAID ***</div>
                  <div className="text-xs">Order: {currentBill.order_number}</div>
                  <div className="text-xs">{new Date(currentBill.paid_at).toLocaleString()}</div>
                </div>
                <div className="border-b border-dashed pb-3 mb-3">
                  {currentBill.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between py-1"><span>{item.quantity}x {item.name}</span><span>KES {(item.price * item.quantity).toLocaleString()}</span></div>
                  ))}
                </div>
                <div className="flex justify-between font-bold text-lg"><span>TOTAL PAID</span><span>KES {currentBill.total.toLocaleString()}</span></div>
                <div className="flex justify-between text-xs text-gray-500 mt-1"><span>Method</span><span className="uppercase">{currentBill.payment_method}</span></div>
                {currentBill.change > 0 && <div className="flex justify-between text-xs"><span>Change</span><span>KES {currentBill.change}</span></div>}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => window.print()} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-1"><Printer className="h-4 w-4" /> Print</button>
                <button onClick={newOrder} className="flex-1 py-2 bg-purple-600 text-white rounded-lg flex items-center justify-center gap-1"><Plus className="h-4 w-4" /> New Order</button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
