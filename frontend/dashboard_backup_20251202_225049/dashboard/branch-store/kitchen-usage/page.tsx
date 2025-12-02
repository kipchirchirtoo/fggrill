'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { Utensils, RefreshCw, Plus, Package, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface KitchenUsage { id: string; item_name: string; quantity: number; usage_date: string; recorded_by: string; }

export default function BranchKitchenUsagePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<KitchenUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [formData, setFormData] = useState({ item_sku: '', received_quantity: 1, usage_date: new Date().toISOString().split('T')[0] });

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getKitchenUsageRecords();
      if (response.success) setRecords(response.data || []);
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

  const handleRecordUsage = async () => {
    if (!formData.item_sku || !formData.received_quantity) { toast.error('Fill required fields'); return; }
    try {
      await storeAPI.createKitchenUsageRecord({ item_sku: formData.item_sku, received_quantity: formData.received_quantity, usage_date: formData.usage_date });
      toast.success('Usage recorded');
      setAddModalOpen(false);
      fetchRecords();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Kitchen Usage</h1><p className="text-gray-500">Track kitchen consumption</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchRecords}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)}><Plus className="h-4 w-4 mr-2" /> Record Usage</IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : records.length === 0 ? (
            <IOSCard className="p-12 text-center"><Utensils className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No usage records</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <IOSCard key={record.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-orange-100 flex items-center justify-center"><Utensils className="h-6 w-6 text-orange-600" /></div>
                      <div>
                        <p className="font-bold">{record.item_name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(record.usage_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className="font-bold text-lg">{record.quantity}</p>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Record Kitchen Usage</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Item *</label>
                <select value={formData.item_sku} onChange={(e) => setFormData({ ...formData, item_sku: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="">Select item</option>
                  {items.map((item) => <option key={item.sku} value={item.sku}>{item.name}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">Quantity *</label><Input type="number" value={formData.received_quantity} onChange={(e) => setFormData({ ...formData, received_quantity: parseInt(e.target.value) || 0 })} /></div>
              <div><label className="text-sm font-medium">Date</label><Input type="date" value={formData.usage_date} onChange={(e) => setFormData({ ...formData, usage_date: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleRecordUsage} className="flex-1">Record</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
