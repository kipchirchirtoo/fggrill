'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { restaurantAPI } from '@/lib/api';
import { ShoppingCart, Plus, Minus, X, Search, Wine, Beer, Coffee, GlassWater } from 'lucide-react';
import { toast } from 'sonner';

interface MenuItem { id: string; name: string; price: number; category_id: string; category_name?: string; is_available: boolean; }
interface CartItem extends MenuItem { quantity: number; }
interface Category { id: string; name: string; }

export default function BarPOSPage() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [tableNumber, setTableNumber] = useState('');
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
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    return matchesSearch && matchesCategory && item.is_available;
  });

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) return prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
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
  const clearCart = () => { setCart([]); setTableNumber(''); };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.16);
  const total = subtotal + tax;

  const handleSubmitOrder = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    setIsSubmitting(true);
    try {
      await restaurantAPI.createOrder({
        order_type: 'dine_in',
        table_number: tableNumber || undefined,
        items: cart.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })),
        subtotal, tax, total,
      });
      toast.success('Order placed!');
      clearCart();
    } catch (error: any) { toast.error(error.message || 'Failed to place order'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="flex gap-6 h-[calc(100vh-120px)]">
          <div className="flex-1 flex flex-col">
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search drinks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                <IOSButton size="sm" variant={selectedCategory === 'all' ? 'primary' : 'secondary'} onClick={() => setSelectedCategory('all')}>All</IOSButton>
                {categories.map((cat) => (
                  <IOSButton key={cat.id} size="sm" variant={selectedCategory === cat.id ? 'primary' : 'secondary'} onClick={() => setSelectedCategory(cat.id)}>{cat.name}</IOSButton>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredItems.map((item) => (
                    <IOSCard key={item.id} className="p-3 cursor-pointer hover:shadow-lg transition active:scale-95" onClick={() => addToCart(item)}>
                      <div className="h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-ios-lg mb-2 flex items-center justify-center">
                        <Wine className="h-8 w-8 text-purple-500" />
                      </div>
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-blue-600 font-bold">KES {item.price?.toLocaleString()}</p>
                    </IOSCard>
                  ))}
                </div>
              )}
            </div>
          </div>

          <IOSCard className="w-96 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-bold text-lg flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Order</h2>
              <Input placeholder="Table Number (optional)" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className="mt-3" />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-400"><ShoppingCart className="h-12 w-12 mx-auto mb-2" /><p>Cart is empty</p></div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-ios-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-blue-600 text-sm">KES {(item.price * item.quantity).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <IOSButton size="sm" variant="secondary" onClick={() => updateQuantity(item.id, -1)}><Minus className="h-3 w-3" /></IOSButton>
                        <span className="w-6 text-center font-medium">{item.quantity}</span>
                        <IOSButton size="sm" variant="secondary" onClick={() => updateQuantity(item.id, 1)}><Plus className="h-3 w-3" /></IOSButton>
                        <IOSButton size="sm" variant="destructive" onClick={() => removeFromCart(item.id)}><X className="h-3 w-3" /></IOSButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t space-y-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>KES {subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Tax (16%)</span><span>KES {tax.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span>KES {total.toLocaleString()}</span></div>
              </div>
              <div className="flex gap-2">
                <IOSButton variant="secondary" onClick={clearCart} className="flex-1" disabled={cart.length === 0}>Clear</IOSButton>
                <IOSButton onClick={handleSubmitOrder} className="flex-1" disabled={cart.length === 0 || isSubmitting}>{isSubmitting ? 'Placing...' : 'Place Order'}</IOSButton>
              </div>
            </div>
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
