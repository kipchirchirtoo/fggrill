'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI, auditAPI, auditorReportsAPI } from '@/lib/api';
import { TrendingDown, RefreshCw, Plus, Package, Calendar, User, Clock, FileText, Tag, ChevronRight, X, FileDown, Activity, AlertTriangle, Check, ShoppingCart, Search } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StockMovement {
  id: string;
  item_sku: string;
  quantity: number;
  movement_type: string;
  reason?: string;
  notes?: string;
  performed_by?: string;
  created_at?: string;
  branch_id?: number;
  item?: {
    sku?: string;
    item_name?: string;
    category?: string;
  };
  auditor_id?: string;
  audited_at?: string;
  audit_notes?: string;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return 'N/A';
  }
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function BranchStockOutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchId = useMemo(() => {
    try {
      const id = searchParams?.get('branch_id');
      return id ? parseInt(id) : (user?.branch_id || undefined);
    } catch (error) {
      console.error('Error reading search params:', error);
      return user?.branch_id || undefined;
    }
  }, [searchParams, user?.branch_id]);

  const [records, setRecords] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StockMovement | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [formData, setFormData] = useState({ item_sku: '', quantity: 1, department: 'kitchen', notes: '' });
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getStockMovements({ branch_id: branchId });
      if (response.success) {
        const stockOuts = (response.data || []).filter(
          (m: any) => m.movement_type === 'STOCK_OUT' || m.movement_type === 'out'
        );

        const uuids = Array.from(new Set(
          stockOuts.map((m: any) => m.performed_by).filter((v: string) => v && UUID_REGEX.test(v))
        ));

        if (uuids.length > 0) {
          try {
            const staffRes = await storeAPI.getBranchStaffForUsage(branchId);
            if (staffRes.success && staffRes.data) {
              const nameMap: Record<string, string> = {};
              (staffRes.data as any[]).forEach((s: any) => {
                nameMap[s.id] = s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || s.id;
              });
              stockOuts.forEach((m: any) => {
                if (m.performed_by && nameMap[m.performed_by]) {
                  m.performed_by = nameMap[m.performed_by];
                }
              });
            }
          } catch (e) { console.error('Failed to resolve user names:', e); }
        }

        setRecords(stockOuts);
      }
    } catch (error) { console.error('Error fetching records:', error); toast.error('Failed to load records'); }
    finally { setIsLoading(false); }
  }, [branchId]);

  const fetchItems = useCallback(async () => {
    try {
      const response = await storeAPI.getBranchStock(branchId);
      if (response.success && response.data) {
        setItems(response.data.map((r: any) => ({
          sku: r.item_sku,
          name: r.item?.item_name || r.item_sku,
          quantity: r.quantity || 0,
          unit: r.item?.unit_of_measure || 'units'
        })));
      }
    } catch (error) { console.error('Error:', error); }
  }, [branchId]);

  useEffect(() => { fetchRecords(); fetchItems(); }, [fetchRecords, fetchItems]);

  const handleStockOut = async () => {
    if (!formData.item_sku) { toast.error('Please select an item'); return; }

    const selectedItem = items.find(i => i.sku === formData.item_sku);
    const availableQty = selectedItem?.quantity ?? 0;

    // Block negative quantities
    if (formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    // Block if stock is 0
    if (availableQty <= 0) {
      toast.error(`"${selectedItem?.name || formData.item_sku}" is out of stock. Request more from central store.`, { duration: 5000 });
      setAddModalOpen(false);
      router.push('/dashboard/branch-store/requests');
      return;
    }

    // Block if issuing more than available
    if (formData.quantity > availableQty) {
      toast.error(
        `Only ${availableQty} unit${availableQty !== 1 ? 's' : ''} available for "${selectedItem?.name || formData.item_sku}". Cannot issue ${formData.quantity}.`,
        { duration: 5000 }
      );
      return;
    }

    try {
      await storeAPI.recordStockOut({
        item_sku: formData.item_sku,
        quantity: formData.quantity,
        reason: formData.department,
        notes: formData.notes,
        movement_type: 'STOCK_OUT',
        branch_id: branchId
      } as any);
      
      const deptName = formData.department.charAt(0).toUpperCase() + formData.department.slice(1);
      toast.success(`Stock automatically approved and issued to ${deptName}`);
      
      setAddModalOpen(false);
      setFormData({ item_sku: '', quantity: 1, department: 'kitchen', notes: '' });
      fetchRecords();
      fetchItems();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleExport = async () => {
    try {
      toast.loading("Generating stock out ledger...");
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      await auditorReportsAPI.exportBrandedPdf('stock_movement', {
        branch_id: branchId,
        movement_type: 'STOCK_OUT',
        start_date: formatDate(thirtyDaysAgo),
        end_date: formatDate(today),
      });
      toast.dismiss();
      toast.success("Ledger generated successfully");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to export ledger");
    }
  };

  const handleFlagAnomaly = async (record: StockMovement) => {
    try {
      toast.loading("Flagging anomaly...");
      await auditAPI.createException({
        audit_session_id: 'MANUAL_STOCK_OUT_' + new Date().getTime(),
        exception_type: 'STOCK_OUT_ANOMALY',
        severity: Math.abs(record.quantity) > 50 ? 'critical' : 'medium',
        description: `Potential anomaly in stock out for ${getItemName(record)}. Quantity: ${record.quantity}. Performed by: ${record.performed_by || 'Unknown'}`,
        amount: Math.abs(record.quantity),
        reference_type: 'stock_movement',
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

  const handleVerify = async (record: StockMovement) => {
    try {
      toast.loading("Verifying record...");
      await auditAPI.verifyAnomaly({
        id: record.id,
        type: 'stock_movement',
        notes: 'Verified by auditor'
      });
      toast.dismiss();
      toast.success("Record verified successfully");
      fetchRecords();
      setSelectedRecord(null);
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to verify record");
    }
  };

  const stats = useMemo(() => {
    const totalQty = records.reduce((acc, r) => acc + Math.abs(r.quantity), 0);
    const highValue = records.filter(r => Math.abs(r.quantity) > 10).length;
    const today = new Date().toISOString().split('T')[0];
    const todays = records.filter(r => r.created_at?.startsWith(today)).length;
    return { totalQty, highValue, todays };
  }, [records]);

  const getItemName = (record: StockMovement) => {
    return record.item?.item_name || record.item_sku || 'Unknown Item';
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user?.role === UserRole.AUDITOR ? 'Stock Out Audit' : 'Stock Out'}
              </h1>
              <p className="text-gray-500">
                {user?.role === UserRole.AUDITOR ? 'Review and verify issued stock records' : 'Issue items to departments - automatically approved'}
              </p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchRecords} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>Refresh</IOSButton>
              {user?.role === UserRole.AUDITOR && (
                <IOSButton variant="secondary" onClick={handleExport} leftIcon={<FileDown />}>Export Ledger</IOSButton>
              )}
              {user?.role !== UserRole.AUDITOR && (
                <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Issue Stock</IOSButton>
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
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Volume</p>
                    <p className="text-xl font-black text-stone-900">{stats.totalQty.toLocaleString()}</p>
                  </div>
                </div>
              </IOSCard>
              <IOSCard className="p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">High Intensity</p>
                    <p className="text-xl font-black text-red-600">{stats.highValue}</p>
                  </div>
                </div>
              </IOSCard>
              <IOSCard className="p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Today's Entries</p>
                    <p className="text-xl font-black text-blue-600">{stats.todays}</p>
                  </div>
                </div>
              </IOSCard>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : records.length === 0 ? (
            <IOSCard className="p-12 text-center"><TrendingDown className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No stock out records</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <IOSCard
                  key={record.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-red-100 flex items-center justify-center">
                        <TrendingDown className="h-6 w-6 text-[#FF3B30]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{getItemName(record)}</p>
                        {record.item?.category && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Tag className="h-3 w-3" /> {record.item.category}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                          {record.reason && <span className="bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{record.reason}</span>}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatDate(record.created_at)}
                          </span>
                          {record.performed_by && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {record.performed_by}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg text-[#FF3B30]">-{Math.abs(record.quantity)}</p>
                      <ChevronRight className="h-5 w-5 text-gray-300" />
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={!!selectedRecord} onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-[#FF3B30]" />
                Stock Out Detail
              </DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <div className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">Quantity Issued</p>
                  <p className="text-3xl font-bold text-[#FF3B30]">-{Math.abs(selectedRecord.quantity)}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <Package className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Item</p>
                      <p className="font-semibold text-gray-900">{getItemName(selectedRecord)}</p>
                      {selectedRecord.item_sku && (
                        <p className="text-xs text-gray-400 mt-0.5">SKU: {selectedRecord.item_sku}</p>
                      )}
                    </div>
                  </div>

                  {selectedRecord.item?.category && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <Tag className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Category</p>
                        <p className="font-semibold text-gray-900">{selectedRecord.item.category}</p>
                      </div>
                    </div>
                  )}

                  {selectedRecord.reason && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <FileText className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Reason / Department</p>
                        <p className="font-semibold text-gray-900">{selectedRecord.reason}</p>
                      </div>
                    </div>
                  )}

                  {selectedRecord.notes && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <FileText className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Notes</p>
                        <p className="font-semibold text-gray-900">{selectedRecord.notes}</p>
                      </div>
                    </div>
                  )}

                  {selectedRecord.performed_by && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <User className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Recorded By</p>
                        <p className="font-semibold text-gray-900">{selectedRecord.performed_by}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <Clock className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Date & Time</p>
                      <p className="font-semibold text-gray-900">
                        {formatDate(selectedRecord.created_at)}
                        {formatTime(selectedRecord.created_at) && ` at ${formatTime(selectedRecord.created_at)}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-stone-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Audit Status</p>
                    {selectedRecord.audited_at ? (
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

                  <IOSButton variant="secondary" onClick={() => setSelectedRecord(null)} className="w-full mb-3">
                    Close
                  </IOSButton>

                  {user?.role === UserRole.AUDITOR && !selectedRecord.audited_at && (
                    <div className="grid grid-cols-2 gap-3">
                      <IOSButton variant="secondary" onClick={() => handleVerify(selectedRecord)} leftIcon={<Check />} className="w-full">
                        Verify Record
                      </IOSButton>
                      <IOSButton variant="destructive" onClick={() => handleFlagAnomaly(selectedRecord)} leftIcon={<AlertTriangle />} className="w-full">
                        Flag Anomaly
                      </IOSButton>
                    </div>
                  )}
                  {user?.role === UserRole.AUDITOR && selectedRecord.audited_at && (
                    <div className="pt-4 border-t border-stone-100 italic text-[10px] text-stone-500">
                      This record was verified on {formatDate(selectedRecord.audited_at)} {formatTime(selectedRecord.audited_at)}.
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Issue Stock to Department</DialogTitle>
              <p className="text-sm text-gray-500 mt-1">Items are automatically approved and synced to department operations</p>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Item *</label>
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="🔍 Search item by name or SKU..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  {itemSearchTerm && (() => {
                    const filteredItems = items.filter(item =>
                      item.name?.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
                      item.sku?.toLowerCase().includes(itemSearchTerm.toLowerCase())
                    );
                    
                    return filteredItems.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto border-2 border-blue-200 rounded-lg bg-white shadow-lg">
                        {filteredItems.map((item) => (
                          <button
                            key={item.sku}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, item_sku: item.sku, quantity: 1 });
                              setItemSearchTerm('');
                            }}
                            disabled={item.quantity <= 0}
                            className={`w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                              item.quantity <= 0 ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{item.name}</p>
                                <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-semibold ${item.quantity <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {item.quantity <= 0 ? '⚠ Out of stock' : `${item.quantity} ${item.unit}`}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500 text-sm border border-gray-200 rounded-lg">
                        No items found matching "{itemSearchTerm}"
                      </div>
                    );
                  })()}
                  
                  {formData.item_sku && (() => {
                    const selectedItem = items.find(i => i.sku === formData.item_sku);
                    if (selectedItem) {
                      return (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{selectedItem.name}</p>
                              <p className="text-xs text-gray-500">SKU: {selectedItem.sku}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, item_sku: '' });
                                setItemSearchTerm('');
                              }}
                              className="p-1 hover:bg-blue-100 rounded"
                            >
                              <X className="h-4 w-4 text-gray-500" />
                            </button>
                          </div>
                          <p className={`text-sm mt-2 font-semibold ${selectedItem.quantity <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {selectedItem.quantity <= 0 ? '⚠ Out of stock' : `${selectedItem.quantity} ${selectedItem.unit} available`}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                
                {formData.item_sku && (() => {
                  const sel = items.find(i => i.sku === formData.item_sku);
                  if (sel && sel.quantity <= 0) return (
                    <div className="mt-2 flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-600 font-medium">This item is out of stock.</p>
                      <button
                        type="button"
                        onClick={() => { setAddModalOpen(false); router.push('/dashboard/branch-store/requests'); }}
                        className="text-xs font-bold text-red-700 underline flex items-center gap-1"
                      >
                        <ShoppingCart className="h-3 w-3" /> Request stock
                      </button>
                    </div>
                  );
                  return null;
                })()}
              </div>
              <div>
                <label className="text-sm font-medium">Quantity *</label>
                <Input
                  type="number"
                  min={1}
                  max={items.find(i => i.sku === formData.item_sku)?.quantity || undefined}
                  value={formData.quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setFormData({ ...formData, quantity: val < 0 ? 0 : val });
                  }}
                />
                {formData.item_sku && (() => {
                  const sel = items.find(i => i.sku === formData.item_sku);
                  if (sel && formData.quantity > sel.quantity && sel.quantity > 0) return (
                    <p className="text-xs text-red-500 mt-1">Only {sel.quantity} unit{sel.quantity !== 1 ? 's' : ''} available</p>
                  );
                  return null;
                })()}
              </div>
              <div><label className="text-sm font-medium">Department *</label>
                <select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="kitchen">Kitchen (Auto-synced)</option>
                  <option value="bar">Bar (Auto-synced)</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="reception">Reception</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Notes</label><Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton
                  onClick={handleStockOut}
                  className="flex-1"
                  disabled={(() => {
                    const sel = items.find(i => i.sku === formData.item_sku);
                    return !formData.item_sku || formData.quantity <= 0 || (sel ? sel.quantity <= 0 : false);
                  })()}
                >
                  Issue & Approve
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
