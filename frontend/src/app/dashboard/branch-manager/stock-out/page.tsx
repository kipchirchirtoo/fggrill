'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Package, Minus, RefreshCw, ArrowRightLeft, Clock, CheckCircle } from 'lucide-react';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';

export default function BranchManagerStockOutPage() {
  const { user } = useAuth();
  const [stock, setStock] = useState<any[]>([]);
  const [stockOutHistory, setStockOutHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('usage');
  const [notes, setNotes] = useState('');

  useEffect(() => { 
    fetchData(); 
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getBranchStock(user?.branch_id);
      const stockData = res?.data?.stock || res?.data || res?.stock || (Array.isArray(res) ? res : []);
      setStock(Array.isArray(stockData) ? stockData : []);
      
      // Fetch stock out history if available
      try {
        const historyRes = await storeAPI.getStockHistory?.(user?.branch_id || undefined);
        const historyData = historyRes?.data || historyRes?.history || (Array.isArray(historyRes) ? historyRes : []);
        setStockOutHistory(Array.isArray(historyData) ? historyData : []);
      } catch {
        // History endpoint may not exist yet
      }
    } catch (error) { 
      console.error('Error:', error); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleStockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return toast.error('Select an item');
    if (quantity <= 0) return toast.error('Quantity must be greater than 0');
    
    const selectedStock = stock.find(s => (s.sku || s.item_sku) === selectedItem);
    if (selectedStock && quantity > selectedStock.quantity) {
      return toast.error(`Only ${selectedStock.quantity} available in stock`);
    }
    
    try {
      await storeAPI.recordStockOut({ 
        item_sku: selectedItem, 
        quantity, 
        reason,
        notes
      });
      toast.success('Stock out recorded successfully');
      setSelectedItem(''); 
      setQuantity(1);
      setNotes('');
      fetchData();
    } catch (error) {
      toast.error('Failed to record stock out');
    }
  };

  const reasons = [
    { value: 'usage', label: 'Kitchen/Restaurant Usage' },
    { value: 'room_service', label: 'Room Service' },
    { value: 'cleaning', label: 'Cleaning/Housekeeping' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'event', label: 'Event/Function' },
    { value: 'transfer', label: 'Branch Transfer' },
    { value: 'other', label: 'Other' }
  ];

  const getSelectedItemDetails = () => {
    return stock.find(s => (s.sku || s.item_sku) === selectedItem);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ArrowRightLeft className="h-6 w-6 text-blue-600" />
                Stock Out
              </h1>
              <p className="text-gray-600">Record items issued from branch stock</p>
            </div>
            <Button onClick={fetchData} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> 
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock Out Form */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Minus className="h-5 w-5 text-red-500" />
                Record Stock Out
              </h2>
              <form onSubmit={handleStockOut} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Item *</label>
                  <select 
                    value={selectedItem} 
                    onChange={(e) => setSelectedItem(e.target.value)} 
                    className="w-full border rounded-lg px-3 py-2.5"
                  >
                    <option value="">-- Select an Item --</option>
                    {stock.map((s: any) => {
                      const sku = s.sku || s.item_sku;
                      const name = s.item_name || s.name || s.item?.name || `Item ${sku}`;
                      return (
                        <option key={sku} value={sku}>
                          {name} — {s.quantity} in stock
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedItem && getSelectedItemDetails() && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      <strong>Current Stock:</strong> {getSelectedItemDetails()?.quantity} units
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Quantity *</label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={quantity} 
                      onChange={(e) => setQuantity(Number(e.target.value))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Reason *</label>
                    <select 
                      value={reason} 
                      onChange={(e) => setReason(e.target.value)} 
                      className="w-full border rounded-lg px-3 py-2.5"
                    >
                      {reasons.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Additional details..."
                  />
                </div>

                <Button type="submit" className="w-full" disabled={!selectedItem || quantity <= 0}>
                  <Minus className="h-4 w-4 mr-2" />
                  Record Stock Out
                </Button>
              </form>
            </Card>

            {/* Current Stock Summary */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-green-500" />
                Current Stock ({stock.length} items)
              </h2>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {stock.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No stock data available</p>
                ) : (
                  stock.map((s: any) => {
                    const sku = s.sku || s.item_sku;
                    const name = s.item_name || s.name || s.item?.name || `Item ${sku}`;
                    const isLow = s.quantity <= (s.reorder_level || 10);
                    return (
                      <div 
                        key={sku} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isLow ? 'bg-amber-50 border-amber-200' : 'bg-gray-50'
                        }`}
                      >
                        <div>
                          <p className="font-medium">{name}</p>
                          <p className="text-xs text-gray-500 font-mono">{sku}</p>
                        </div>
                        <Badge className={isLow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}>
                          {s.quantity} units
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* Recent Stock Out History */}
          {stockOutHistory.length > 0 && (
            <Card>
              <div className="p-4 border-b">
                <h2 className="font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-500" />
                  Recent Stock Out History
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stockOutHistory.slice(0, 10).map((h: any, idx: number) => (
                      <tr key={h.id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{h.item_name || h.item?.name || h.item_sku}</td>
                        <td className="px-4 py-3">{h.quantity}</td>
                        <td className="px-4 py-3 text-sm">{h.reason}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(h.created_at)}</td>
                        <td className="px-4 py-3">
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Recorded
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
