'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Plus, Minus, Send, ArrowLeft, Search } from 'lucide-react';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CartItem {
  item_sku: string;
  item_name: string;
  quantity: number;
  available: number;
}

export default function NewStockRequestPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('NORMAL');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getMasterCatalog();
      setItems(Array.isArray(res.data) ? res.data : res.items || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load items');
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (item: any) => {
    const existing = cart.find(c => c.item_sku === item.sku);
    if (existing) {
      setCart(cart.map(c => 
        c.item_sku === item.sku ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([...cart, {
        item_sku: item.sku,
        item_name: item.item_name,
        quantity: 1,
        available: item.quantity || 0
      }]);
    }
  };

  const updateQuantity = (sku: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.item_sku === sku) {
        const newQty = Math.max(1, c.quantity + delta);
        return { ...c, quantity: newQty };
      }
      return c;
    }));
  };

  const removeFromCart = (sku: string) => {
    setCart(cart.filter(c => c.item_sku !== sku));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Add items to your request');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await storeAPI.createStockRequest({
        items: cart.map(c => ({ item_sku: c.item_sku, quantity: c.quantity })),
        notes,
        priority
      });
      toast.success('Stock request submitted!');
      router.push('/dashboard/branch-store/requests');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(i => 
    i.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/branch-store">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">New Stock Request</h1>
              <p className="text-gray-600">Request items from central warehouse</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Items List */}
            <div className="lg:col-span-2">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2"
                  />
                </div>

                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading items...</div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {filteredItems.map((item) => (
                      <div key={item.sku} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-xs text-gray-500">{item.sku} • {item.quantity || 0} available</p>
                        </div>
                        <Button size="sm" onClick={() => addToCart(item)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Cart */}
            <div>
              <Card className="p-4 sticky top-4">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Your Request ({cart.length} items)
                </h2>

                {cart.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No items added yet</p>
                ) : (
                  <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.item_sku} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.item_name}</p>
                          <p className="text-xs text-gray-500">{item.item_sku}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => updateQuantity(item.item_sku, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button size="sm" variant="ghost" onClick={() => updateQuantity(item.item_sku, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => removeFromCart(item.item_sku)}>
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 mt-1"
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 mt-1"
                      rows={2}
                      placeholder="Optional notes..."
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleSubmit}
                    disabled={cart.length === 0 || isSubmitting}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
