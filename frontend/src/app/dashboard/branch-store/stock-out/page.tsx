'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { TrendingDown, RefreshCw, Plus, Package, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface StockOut { id: string; item_name: string; quantity: number; department: string; recorded_by: string; date: string; }

export default function BranchStockOutPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<StockOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [formData, setFormData] = useState({ item_sku: '', quantity: 1, department: 'kitchen', notes: '' });

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getStockMovements();
      if (response.success) {
        const stockOuts = (response.data || []).filter((m: any) => m.movement_type === 'out');
        setRecords(stockOuts);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const response = await storeAPI.getBranchStock();
      if (response.success) setItems(response.data || []);
    } catch (error) { console.error('Error:', error); }
  }, []);

  useEffect(() => { fetchRecords(); fetchItems(); }, [fetchRecords, fetchItems]);

  const handleStockOut = async () => {
    if (!formData.item_sku || !formData.quantity) { toast.error('Fill required fields'); return; }
    try {
      await storeAPI.recordStockOut({ item_sku: formData.item_sku, quantity: formData.quantity, department: formData.department, notes: formData.notes });
      toast.success('Stock out recorded');
      setAddModalOpen(false);
      fetchRecords();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Out</h1><p className="text-gray-500">Issue items from stock</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchRecords}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)}><Plus className="h-4 w-4 mr-2" /> Issue Stock</IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : records.length === 0 ? (
            <IOSCard className="p-12 text-center"><TrendingDown className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No stock out records</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <IOSCard key={record.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-red-100 flex items-center justify-center"><TrendingDown className="h-6 w-6 text-[#FF3B30]" /></div>
                      <div>
                        <p className="font-bold">{record.item_name}</p>
                        <p className="text-sm text-gray-500">{record.department}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-2"><User className="h-3 w-3" /> {record.recorded_by} <Calendar className="h-3 w-3 ml-2" /> {new Date(record.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className="font-bold text-lg text-[#FF3B30]">-{record.quantity}</p>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Issue Stock</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Item *</label>
                <select value={formData.item_sku} onChange={(e) => setFormData({ ...formData, item_sku: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="">Select item</option>
                  {items.map((item) => <option key={item.sku} value={item.sku}>{item.name} ({item.quantity} available)</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">Quantity *</label><Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} /></div>
              <div><label className="text-sm font-medium">Department</label>
                <select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="kitchen">Kitchen</option>
                  <option value="bar">Bar</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Notes</label><Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleStockOut} className="flex-1">Issue</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
