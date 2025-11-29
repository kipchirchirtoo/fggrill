'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Package, Minus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function BranchStoreStockOutPage() {
  const { user } = useAuth();
  const [stock, setStock] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('usage');

  useEffect(() => { fetchStock(); }, [user]);

  const fetchStock = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getBranchStock(user?.branch_id);
      // Handle various API response formats
      const stockData = res?.data?.stock || res?.data || res?.stock || (Array.isArray(res) ? res : []);
      setStock(Array.isArray(stockData) ? stockData : []);
    } catch (error) { console.error('Error:', error); } 
    finally { setIsLoading(false); }
  };

  const handleStockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return toast.error('Select an item');
    try {
      await storeAPI.recordStockOut({ item_sku: selectedItem, quantity, reason });
      toast.success('Stock out recorded');
      setSelectedItem(''); setQuantity(1);
      fetchStock();
    } catch (error) {
      toast.error('Failed to record stock out');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Record Stock Out</h1>
              <p className="text-gray-600">Record items taken from branch stock</p>
            </div>
            <Button onClick={fetchStock} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Card className="p-6">
            <form onSubmit={handleStockOut} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Item</label>
                <select value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                  <option value="">-- Select Item --</option>
                  {stock.map((s: any) => (
                    <option key={s.sku || s.item_sku} value={s.sku || s.item_sku}>
                      {s.item_name || s.name} ({s.quantity} in stock)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reason</label>
                  <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                    <option value="usage">Usage</option>
                    <option value="damage">Damage</option>
                    <option value="expired">Expired</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full">
                <Minus className="h-4 w-4 mr-2" /> Record Stock Out
              </Button>
            </form>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
