'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { barAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';
import { ShoppingCart, Plus, Minus, X, Search, Wine } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import Image from 'next/image';

interface Drink {
  id: string;
  name: string;
  price: number;
  category_id: string;
  category_name?: string;
  is_available: boolean;
  unit?: string;
  image_url?: string;
}
interface CartItem extends Drink { quantity: number; }
interface Category { id: string; name: string; }

export default function BarPOSPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [tableNumber, setTableNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openTabs, setOpenTabs] = useState<any[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<string>('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [drinksRes, categoriesRes, tabsRes] = await Promise.all([
        barAPI.getDrinks(),
        barAPI.getCategories(),
        barAPI.getTabs(activeBranchId || undefined, 'open')
      ]);
      if (drinksRes.success) {
        const availableDrinks = (drinksRes.data || []).filter((d: Drink) => d.is_available !== false);
        setDrinks(availableDrinks);
      }
      if (categoriesRes.success) setCategories(categoriesRes.data || []);
      if (tabsRes.success) setOpenTabs(tabsRes.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [activeBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDrinks = drinks.filter((drink) => {
    const matchesSearch = drink.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || drink.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (drink: Drink) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === drink.id);
      if (existing) return prev.map((i) => i.id === drink.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...drink, quantity: 1 }];
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
  const clearCart = () => { setCart([]); setTableNumber(''); setSelectedTabId(''); };

  // VAT is INCLUDED in menu prices (16%) - calculate breakdown for display only
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotal = Math.round(total / 1.16);
  const tax = total - subtotal;

  const handleGenerateBill = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    setIsSubmitting(true);
    try {
      if (selectedTabId) {
        // Add to existing tab
        const res = await barAPI.addToTab(selectedTabId, cart.map((item) => ({
          drink_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })));

        if (res.success) {
          toast.success('Added to tab!');
          clearCart();
          fetchData(); // Refresh tabs to get updated totals if needed
          return;
        }
        throw new Error(res.message || 'Failed to add to tab');
      }

      // 1. Create Order (Completed immediately)
      const orderRes = await barAPI.createOrder({
        branch_id: activeBranchId,
        order_type: 'bar',
        seat_number: tableNumber || undefined,
        items: cart.map((item) => ({
          drink_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        payment_method: 'cash',
        status: 'completed' // Mark as completed immediately
      });

      if (orderRes.success) {
        toast.success('Order placed!');

        // 2. Generate Receipt
        try {
          // Import receiptsAPI dynamically if needed or assume it's available in imports
          // We need to add receiptsAPI to imports first, but for now let's assume it's there or we'll add it
          const { receiptsAPI } = require('@/lib/api');

          const receiptData = {
            receipt_type: 'sale',
            receipt_number: orderRes.data.order_number || orderRes.data.id.substring(0, 8),
            date: new Date().toISOString(),
            table_number: tableNumber,
            items: cart.map(item => ({
              name: item.name,
              quantity: item.quantity,
              unit_price: item.price,
              total: item.price * item.quantity
            })),
            total_amount: total,
            payment_method: 'Cash'
          };

          const receiptRes = await receiptsAPI.generateReceipt(receiptData);

          if (receiptRes.success && receiptRes.data?.pdf_base64) {
            // Open PDF in new window
            const pdfWindow = window.open("");
            if (pdfWindow) {
              pdfWindow.document.write(
                `<iframe width='100%' height='100%' src='data:application/pdf;base64,${receiptRes.data.pdf_base64}'></iframe>`
              );
            } else {
              toast.error('Pop-up blocked. Cannot show receipt.');
            }
          } else {
            toast.error('Failed to generate receipt');
          }
        } catch (receiptError) {
          console.error('Receipt generation failed:', receiptError);
          toast.error('Order saved but receipt generation failed');
        }

        clearCart();
      }
    } catch (error: any) { toast.error(error.message || 'Failed to place order'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[calc(100vh-120px)]">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between lg:hidden mb-2">
                <h1 className="text-xl font-bold text-stone-900">Bar POS</h1>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input placeholder="Search drinks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-[44px]" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                <IOSButton size="sm" variant={selectedCategory === 'all' ? 'primary' : 'secondary'} onClick={() => setSelectedCategory('all')} className="whitespace-nowrap h-[36px]">All</IOSButton>
                {categories.map((cat) => (
                  <IOSButton key={cat.id} size="sm" variant={selectedCategory === cat.id ? 'primary' : 'secondary'} onClick={() => setSelectedCategory(cat.id)} className="whitespace-nowrap h-[36px]">{cat.name}</IOSButton>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto lg:pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007AFF]" /></div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
                  {filteredDrinks.map((drink) => (
                    <IOSCard key={drink.id} className="p-3 cursor-pointer hover:shadow-md transition active:scale-95" onClick={() => addToCart(drink)}>
                      <div className="h-24 bg-gradient-to-br from-amber-100 to-orange-100 rounded-ios-lg mb-2 flex items-center justify-center overflow-hidden relative">
                        {drink.image_url ? (
                          <Image
                            src={drink.image_url}
                            alt={drink.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 33vw"
                            priority={true}
                          />
                        ) : (
                          <Wine className="h-8 w-8 text-amber-600" />
                        )}
                      </div>
                      <p className="font-medium text-sm truncate">{drink.name}</p>
                      <p className="text-amber-600 font-bold">KES {drink.price?.toLocaleString()}</p>
                    </IOSCard>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div id="cart-section" className="w-full lg:w-96 flex flex-col gap-4">
            {/* Cart */}
            <IOSCard className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b">
                <h2 className="font-bold text-lg flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Order Summary</h2>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-stone-500 uppercase mb-1 block">Tab Selection</label>
                    <select
                      className="w-full p-2.5 border rounded-ios-lg text-sm bg-stone-50 h-[44px]"
                      value={selectedTabId}
                      onChange={(e) => setSelectedTabId(e.target.value)}
                    >
                      <option value="">New Order (No Tab)</option>
                      {openTabs.map((tab) => (
                        <option key={tab.id} value={tab.id}>
                          Tab #{tab.tab_number} - {tab.customer_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-500 uppercase mb-1 block">Seat / Point Information</label>
                    <Input placeholder="Table or Seat No." value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className="h-[44px]" />
                  </div>
                </div>
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
                          <p className="text-amber-600 text-sm">KES {(item.price * item.quantity).toLocaleString()}</p>
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
                  <div className="flex justify-between text-gray-600"><span>Subtotal (excl. VAT)</span><span>KES {subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-gray-600"><span>VAT (16% incl.)</span><span>KES {tax.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span>KES {total.toLocaleString()}</span></div>
                </div>
                <div className="flex flex-col xs:flex-row gap-2">
                  <IOSButton variant="secondary" onClick={clearCart} className="flex-1 h-[44px]" disabled={cart.length === 0}>Clear Order</IOSButton>
                  <IOSButton onClick={handleGenerateBill} className="flex-1 h-[44px] font-bold" disabled={cart.length === 0 || isSubmitting}>
                    {isSubmitting ? 'Processing...' : (selectedTabId ? 'Add to Tab' : 'Place Order')}
                  </IOSButton>
                </div>
              </div>
            </IOSCard>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
