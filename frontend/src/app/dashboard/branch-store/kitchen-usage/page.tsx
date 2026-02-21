'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI, auditAPI, auditorReportsAPI } from '@/lib/api';
import { Utensils, RefreshCw, Plus, Package, Calendar, FileDown, Activity, AlertTriangle, Users, Check } from 'lucide-react';
import { toast } from 'sonner';

interface KitchenUsage { id: string; item_sku: string; item_name: string; quantity: number; usage_date: string; recorded_by: string; recorded_by_name: string; status: string; audited_at?: string; auditor_id?: string; audit_notes?: string; }
interface UsageEntry { id: string; usage_type: string; quantity: number; notes: string; usage_date: string; produced_item: string; portions_produced: number; recorded_by_name: string; }

export default function BranchKitchenUsagePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<KitchenUsage[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<KitchenUsage | null>(null);
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
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
      const response = await storeAPI.getTrackableItems();
      if (response.success) setItems(response.data || []);
    } catch (error) { console.error('Error fetching trackable items:', error); }
  }, []);

  const fetchEntries = async (recordId: string) => {
    setIsDetailLoading(true);
    try {
      const response = await storeAPI.getKitchenUsageEntries(recordId);
      if (response.success) setEntries(response.data || []);
    } catch (error) { console.error('Error fetching entries:', error); toast.error('Failed to load details'); }
    finally { setIsDetailLoading(false); }
  };

  const handleCardClick = (record: KitchenUsage) => {
    setSelectedRecord(record);
    setDetailModalOpen(true);
    fetchEntries(record.id);
  };

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

  const handleExport = async () => {
    try {
      toast.loading("Generating usage ledger...");
      await auditorReportsAPI.exportBrandedPdf('kitchen_usage', {
        branch_id: user?.branch_id
      });
      toast.dismiss();
      toast.success("Ledger generated successfully");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to export ledger");
    }
  };

  const handleFlagAnomaly = async (record: KitchenUsage) => {
    try {
      toast.loading("Flagging anomaly...");
      await auditAPI.createException({
        audit_session_id: 'MANUAL_KITCHEN_USAGE_' + new Date().getTime(),
        exception_type: 'USAGE_ANOMALY',
        severity: 'medium',
        description: `Oversight: Potential anomaly in kitchen usage for ${record.item_name}. Recorded by: ${record.recorded_by_name || 'Unknown'}`,
        amount: record.quantity,
        reference_type: 'kitchen_usage',
        reference_id: record.id,
      });
      toast.dismiss();
      toast.success("Anomaly flagged for review");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to flag anomaly");
    }
  };

  const handleVerify = async (record: KitchenUsage) => {
    try {
      toast.loading("Verifying record...");
      await auditAPI.verifyAnomaly({
        id: record.id,
        type: 'kitchen_usage',
        notes: 'Verified by auditor'
      });
      toast.dismiss();
      toast.success("Record verified successfully");
      fetchRecords(); // Refresh data
      setDetailModalOpen(false); // Close modal
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to verify record");
    }
  };

  const stats = useMemo(() => {
    const totalVolume = records.reduce((acc, r) => acc + (r.quantity || 0), 0);
    const uniqueItems = new Set(records.map(r => r.item_sku)).size;
    const completionRate = records.length > 0
      ? Math.round((records.filter(r => r.status === 'COMPLETED').length / records.length) * 100)
      : 100;
    return { totalVolume, uniqueItems, completionRate };
  }, [records]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RESTAURANT, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user?.role === UserRole.AUDITOR ? 'Kitchen Usage Audit' : 'Kitchen Usage'}
              </h1>
              <p className="text-gray-500">
                {user?.role === UserRole.AUDITOR ? 'Review kitchen consumption records' : 'Track kitchen consumption'}
              </p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchRecords} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>Refresh</IOSButton>
              {user?.role === UserRole.AUDITOR && (
                <IOSButton variant="secondary" onClick={handleExport} leftIcon={<FileDown />}>Export Log</IOSButton>
              )}
              {user?.role !== UserRole.AUDITOR && (
                <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Record Usage</IOSButton>
              )}
            </div>
          </div>

          {user?.role === UserRole.AUDITOR && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <IOSCard className="p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Active Items</p>
                    <p className="text-xl font-black text-stone-900">{stats.uniqueItems}</p>
                  </div>
                </div>
              </IOSCard>
              <IOSCard className="p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Consumption</p>
                    <p className="text-xl font-black text-orange-600">{stats.totalVolume.toLocaleString()}</p>
                  </div>
                </div>
              </IOSCard>
              <IOSCard className="p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Completion Rate</p>
                    <p className="text-xl font-black text-emerald-600">{stats.completionRate}%</p>
                  </div>
                </div>
              </IOSCard>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : records.length === 0 ? (
            <IOSCard className="p-12 text-center"><Utensils className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No usage records</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <IOSCard
                  key={record.id}
                  className="p-4 cursor-pointer hover:bg-gray-50 active:scale-[0.98] transition-all bg-white"
                  onClick={() => handleCardClick(record)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-orange-100 flex items-center justify-center"><Utensils className="h-6 w-6 text-orange-600" /></div>
                      <div>
                        <p className="font-bold">{record.item_name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(record.usage_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{record.quantity}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${record.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        record.status === 'PARTIAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                        {record.status}
                      </span>
                    </div>
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
                  {items.map((item) => <option key={item.item_sku} value={item.item_sku}>{item.item_name} ({item.quantity} available)</option>)}
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

        <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Usage Details: {selectedRecord?.item_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded-ios-lg">
                <div><p className="text-gray-500 text-xs">Total Quantity</p><p className="font-bold text-base">{selectedRecord?.quantity}</p></div>
                <div><p className="text-gray-500 text-xs">Status</p><p className="font-bold text-base">{selectedRecord?.status}</p></div>
                <div><p className="text-gray-500 text-xs">Date</p><p className="font-bold">{selectedRecord && new Date(selectedRecord.usage_date).toLocaleDateString()}</p></div>
                <div><p className="text-gray-500 text-xs">Recorded By</p><p className="font-bold">{selectedRecord?.recorded_by_name || 'System'}</p></div>
                <div><p className="text-gray-500 text-xs">SKU</p><p className="font-bold">{selectedRecord?.item_sku}</p></div>
              </div>

              <div>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Package className="h-4 w-4" /> Usage entries</h3>
                {isDetailLoading ? (
                  <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin text-gray-300" /></div>
                ) : entries.length === 0 ? (
                  <p className="text-center py-4 text-gray-400 text-sm">No entries recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <div key={entry.id} className="p-3 border rounded-ios-lg bg-white">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${entry.usage_type === 'CONSUMED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>{entry.usage_type}</span>
                          <div className="text-right">
                            <p className="font-bold leading-none">{entry.quantity}</p>
                            <p className="text-[9px] text-gray-400">{entry.recorded_by_name}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 italic">"{entry.notes || 'No notes'}"</p>
                        {entry.produced_item && (
                          <p className="text-[10px] mt-1 text-gray-500 font-medium">Produced: {entry.produced_item} ({entry.portions_produced} segments)</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Audit Status</p>
                  {selectedRecord?.audited_at ? (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <Check className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Unverified</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <IOSButton onClick={() => setDetailModalOpen(false)} variant="secondary" className="w-full">Close</IOSButton>
                  {user?.role === UserRole.AUDITOR && !selectedRecord?.audited_at && (
                    <IOSButton variant="secondary" onClick={() => handleVerify(selectedRecord!)} leftIcon={<Check />} className="w-full">
                      Verify
                    </IOSButton>
                  )}
                </div>

                {user?.role === UserRole.AUDITOR && !selectedRecord?.audited_at && (
                  <IOSButton variant="destructive" onClick={() => handleFlagAnomaly(selectedRecord!)} leftIcon={<AlertTriangle />} className="w-full">
                    Flag Anomaly
                  </IOSButton>
                )}
                {user?.role === UserRole.AUDITOR && selectedRecord?.audited_at && (
                  <div className="pt-2 italic text-[10px] text-stone-500">
                    Verified on {selectedRecord.audited_at ? new Date(selectedRecord.audited_at).toLocaleDateString() : 'N/A'}.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
